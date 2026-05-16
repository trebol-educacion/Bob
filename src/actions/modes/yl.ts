'use server';

import { z } from 'zod';
import { getAiClient } from '../_shared';
import { MODELS } from '@/lib/models';
import { EvalResponseSchema, type EvalResponse, type ModeKey } from '@/lib/types/practice';
import { YLPlanSchema, type YLPlan, type YLExam, type YLTurnEvalResult } from '@/lib/types/yl';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { createSupabaseServer } from '@/lib/supabase/server';
import { persistMessage, persistMessages } from '@/lib/persist-activity';

/** Map a ModeKey to exam + part number. */
function parseYLMode(mode: ModeKey): { exam: YLExam; part: number } {
  const match = mode.match(/^cambridge_(starters|movers)_part(\d+)$/);
  if (!match) throw new Error(`[yl.ts] Unrecognised YL mode key: ${mode}`);
  return { exam: match[1] as YLExam, part: Number(match[2]) };
}

/** Build the generation prompt key for a given exam+part. */
function generationKey(exam: YLExam, part: number): string {
  return `cambridge_${exam}_part${part}_a1_generation`;
}

/** Build the evaluation prompt key. */
function evaluationKey(exam: YLExam, part: number): string {
  return `cambridge_${exam}_part${part}_a1_evaluation`;
}

/** Build the examiner reaction prompt key. */
function reactionKey(exam: YLExam, part: number): string {
  return `cambridge_${exam}_part${part}_a1_examiner_reaction`;
}

/** Build the image_gen prompt key. */
function imageGenKey(exam: YLExam, part: number): string {
  return `cambridge_${exam}_part${part}_a1_image_gen`;
}

export async function startYLSessionAction(input: {
  mode: ModeKey;
}): Promise<{ sessionId: string; plan: YLPlan }> {
  const { exam, part } = parseYLMode(input.mode);

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('[startYLSessionAction] Not authenticated');

  const partTitles: Record<string, string> = {
    starters_1: 'Starters Part 1 — Señalar imágenes',
    starters_2: 'Starters Part 2 — Preguntas sobre escena',
    starters_3: 'Starters Part 3 — Historia con imágenes',
    starters_4: 'Starters Part 4 — Preguntas personales',
    movers_1: 'Movers Part 1 — Encuentra diferencias',
    movers_2: 'Movers Part 2 — Intercambio de información',
    movers_3: 'Movers Part 3 — Cuenta la historia',
    movers_4: 'Movers Part 4 — Preguntas personales',
    movers_5: 'Movers Part 5 — Describe la imagen',
  };
  const titleKey = `${exam}_${part}`;
  const title = partTitles[titleKey] ?? `Cambridge ${exam} Part ${part}`;

  const t0 = Date.now();
  const { data: session, error: sessionErr } = await supabase
    .from('bob_sessions')
    .insert({
      user_id: user.id,
      mode: input.mode,
      topic: `${exam}_part${part}`,
      title,
    })
    .select()
    .single();

  if (sessionErr || !session) {
    throw new Error(`[startYLSessionAction] Failed to create session: ${sessionErr?.message}`);
  }

  const { data: recent } = await supabase
    .from('bob_sessions')
    .select('plan_json')
    .eq('user_id', user.id)
    .eq('mode', input.mode)
    .not('plan_json', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  const avoidSummary = (recent ?? [])
    .map((r) => {
      const p = r.plan_json as { options?: string[]; cues?: unknown[] } | null;
      if (!p) return null;
      if (p.options && p.options.length > 0) return `[${p.options.join(', ')}]`;
      if (p.cues && p.cues.length > 0)
        return `[${(p.cues as Array<string | { text?: string }>).map((c) => (typeof c === 'string' ? c : c.text ?? '')).slice(0, 3).join(' | ')}…]`;
      return null;
    })
    .filter((s): s is string => s !== null)
    .join('\n- ');

  const avoidList = avoidSummary ? `- ${avoidSummary}` : '(none yet — feel free to pick any topic)';

  const t1 = Date.now();
  const plan = await generateYLContentAction(exam, part, { avoidList });
  console.log(`[YL][${input.mode}] plan ready in ${Date.now() - t1}ms (cues=${plan.cues?.length ?? 0}, images=${plan.image_prompts?.length ?? 0})`);

  await supabase.from('bob_sessions').update({ plan_json: plan }).eq('id', session.id);

  return { sessionId: session.id as string, plan };
}

/**
 * Persist a single scene image. Called once per image from the client to
 * stay well under the Next server-action body limit and the array-nesting
 * cap. Idempotent over (session, image_index) thanks to the index check.
 */
export async function persistYLImageAction(
  sessionId: string,
  imageDataUri: string,
  imageIndex: number
): Promise<void> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('[persistYLImageAction] Not authenticated');

  await persistMessage({
    sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'image_scene',
    contentText: null,
    contentJson: { image_data_uri: imageDataUri, image_index: imageIndex },
  });
}

/** Deprecated: kept for backwards compatibility — iterates one image at a time. */
export async function persistYLImagesAction(
  sessionId: string,
  imageDataUris: string[]
): Promise<void> {
  for (let i = 0; i < imageDataUris.length; i++) {
    await persistYLImageAction(sessionId, imageDataUris[i], i);
  }
}

/**
 * Persist a client-computed final evaluation (used by Pointing-style
 * activities where the score is derived from click-accuracy rather than
 * via Gemini). Saves the same `msg_type='evaluation'` row shape used by
 * evaluateYLFinalAction so reopen logic finds it identically.
 */
export async function saveYLFinalEvalAction(
  sessionId: string,
  evalResult: EvalResponse
): Promise<void> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('[saveYLFinalEvalAction] Not authenticated');
  await persistMessage({
    sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'evaluation',
    contentText: null,
    contentJson: { ...evalResult, is_final: true },
  });
}

import { generateSpeechAction } from '@/actions/gemini';

export async function getOrCreateCueAudioAction(
  sessionId: string,
  cueText: string
): Promise<{ data: string; mimeType: string }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('[getOrCreateCueAudioAction] Not authenticated');

  const { data: existing } = await supabase
    .from('bob_messages')
    .select('content_json')
    .eq('session_id', sessionId)
    .eq('msg_type', 'yl_tts')
    .eq('content_text', cueText)
    .limit(1)
    .maybeSingle();

  if (existing?.content_json) {
    const cached = existing.content_json as { audio_b64?: string; mime?: string };
    if (cached.audio_b64) {
      return { data: cached.audio_b64, mimeType: cached.mime ?? 'audio/L16;codec=pcm;rate=24000' };
    }
  }

  const { data, mimeType } = await generateSpeechAction(cueText);

  await persistMessage({
    sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'yl_tts',
    contentText: cueText,
    contentJson: { audio_b64: data, mime: mimeType },
  });

  return { data, mimeType };
}

export async function generateYLContentAction(
  exam: YLExam,
  part: number,
  options?: { avoidList?: string }
): Promise<YLPlan> {
  const ai = getAiClient();
  const promptText = await getPrompt(generationKey(exam, part), {
    AVOID_LIST: options?.avoidList ?? '(none)',
  });

  const response = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const raw = response.text ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('[generateYLContentAction] Gemini returned invalid JSON');
  }

  // Generation prompts use mixed key names across exam parts; normalize to
  // canonical YLPlanSchema shape before validating.
  const p = (parsed ?? {}) as Record<string, unknown>;

  // Pointing-shape: Starters P1 / Movers P1 click activity.
  const isPointing =
    Array.isArray(p.options) &&
    Array.isArray(p.option_image_prompts) &&
    Array.isArray(p.cues) &&
    p.cues.length > 0 &&
    typeof (p.cues as unknown[])[0] === 'object';

  const normalized: Record<string, unknown> = {
    cues: isPointing
      ? (p.cues as Array<{ text: string }>).map((c) => c.text)
      : (p.cues as unknown[]) ??
        (p.examiner_cues as unknown[]) ??
        (p.target_questions as unknown[]) ??
        (typeof p.scene_description === 'string' ? [p.scene_description] : []),
    image_prompts: isPointing
      ? (p.option_image_prompts as unknown[])
      : (p.image_prompts as unknown[]) ??
        (typeof p.image_prompt === 'string' ? [p.image_prompt] : undefined),
    character_description: p.character_description ?? p.character ?? undefined,
    story_title: p.story_title ?? p.title ?? undefined,
    story_beats: (p.story_beats as unknown[]) ?? (p.beats as unknown[]) ?? undefined,
    student_card: p.student_card ?? undefined,
    examiner_card: p.examiner_card ?? undefined,
    target_questions: (p.target_questions as unknown[]) ?? undefined,
    options: isPointing ? (p.options as unknown[]) : undefined,
    option_image_prompts: isPointing ? (p.option_image_prompts as unknown[]) : undefined,
    pointing_cues: isPointing ? (p.cues as unknown[]) : undefined,
  };

  const result = YLPlanSchema.safeParse(normalized);
  if (!result.success) {
    throw new Error(
      `[generateYLContentAction] Invalid YL plan from AI: ${result.error.message}`
    );
  }

  return result.data;
}

/**
 * Generate a single YL image. Called one-at-a-time from the client to
 * avoid Next.js server-action "Maximum array nesting" when several large
 * base64 strings travel together. Iterate at the call site, not here.
 */
export async function generateYLImageAction(
  exam: YLExam,
  part: number,
  imagePrompt: string,
  idx: number,
  totalImages: number,
  sessionId: string,
  characterDescription?: string
): Promise<string> {
  const key = imageGenKey(exam, part);
  const ai = getAiClient();
  const t0 = Date.now();

  const params: Record<string, string> = {
    IMAGE_PROMPT: imagePrompt,
    SCENE_DESCRIPTION: imagePrompt,
    DIFFERENCES_LIST: imagePrompt,
    CONTEXT_DESCRIPTION: imagePrompt,
  };
  if (characterDescription) {
    params.CHARACTER_DESCRIPTION = characterDescription;
  }
  const fullPrompt = await getPrompt(key, params);

  let imgB64: string | null = null;
  let mime = 'image/png';
  for (let attempt = 0; attempt < 2; attempt++) {
    const tImg = Date.now();
    const response = await ai.models.generateContent({
      model: MODELS.IMAGE,
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      config: { responseModalities: ['IMAGE'] },
    });
    console.log(`[YL][${exam}_part${part}] image ${idx + 1} attempt ${attempt + 1} returned in ${Date.now() - tImg}ms (elapsed ${Date.now() - t0}ms)`);
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imagePart = parts.find((p: any) => p.inlineData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (imagePart as any)?.inlineData?.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partMime = (imagePart as any)?.inlineData?.mimeType ?? 'image/png';
    if (data) {
      imgB64 = data;
      mime = partMime;
      break;
    }
    console.warn(`[generateYLImageAction] empty image attempt ${attempt + 1}, prompt:`, fullPrompt.slice(0, 200));
  }

  if (!imgB64) {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  }

  // Upload to Supabase Storage — avoids Next.js body size limits for large base64 payloads.
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('[generateYLImageAction] Not authenticated');

  const ext = mime.includes('jpeg') ? 'jpg' : 'png';
  const path = `${user.id}/${sessionId}/${idx}.${ext}`;
  const bytes = Buffer.from(imgB64, 'base64');
  const upload = await supabase.storage
    .from('bob-images')
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (upload.error) {
    console.error('[generateYLImageAction] storage upload failed:', upload.error);
    return `data:${mime};base64,${imgB64}`;
  }

  const { data: pub } = supabase.storage.from('bob-images').getPublicUrl(path);
  return pub.publicUrl;
}

/**
 * @deprecated batched variant — kept temporarily for callers that still
 * pass an array. Internally fans out to generateYLImageAction one at a
 * time on the SERVER, but the response (array of 4 base64) is still huge
 * and breaks Next's array nesting. Prefer calling generateYLImageAction
 * directly from the client in a loop.
 */
export async function generateYLImagesAction(
  exam: YLExam,
  part: number,
  imagePrompts: string[],
  characterDescription?: string
): Promise<string[]> {
  const key = imageGenKey(exam, part);
  const ai = getAiClient();

  console.log(`[YL][${exam}_part${part}] generating ${imagePrompts.length} image(s)`);
  const t0 = Date.now();

  return Promise.all(
    imagePrompts.map(async (imagePrompt, idx) => {
      const params: Record<string, string> = {
        IMAGE_PROMPT: imagePrompt,
        SCENE_DESCRIPTION: imagePrompt,
        DIFFERENCES_LIST: imagePrompt,
        CONTEXT_DESCRIPTION: imagePrompt,
      };
      if (characterDescription) {
        params.CHARACTER_DESCRIPTION = characterDescription;
      }

      const fullPrompt = await getPrompt(key, params);

      for (let attempt = 0; attempt < 2; attempt++) {
        const tImg = Date.now();
        const response = await ai.models.generateContent({
          model: MODELS.IMAGE,
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          config: { responseModalities: ['IMAGE'] },
        });
        console.log(`[YL][${exam}_part${part}] image ${idx + 1} attempt ${attempt + 1} returned in ${Date.now() - tImg}ms (total elapsed ${Date.now() - t0}ms)`);
        const parts = response.candidates?.[0]?.content?.parts ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imagePart = parts.find((p: any) => p.inlineData);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (imagePart as any)?.inlineData?.data;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mime = (imagePart as any)?.inlineData?.mimeType ?? 'image/png';
        if (data) {
          return `data:${mime};base64,${data}`;
        }
        console.warn(`[generateYLImagesAction] empty image (attempt ${attempt + 1}); prompt:`, fullPrompt.slice(0, 200));
      }
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    })
  );
}

export async function saveYLTurnAction(
  sessionId: string,
  turn: {
    cue: string;
    cueIndex: number;
    transcript: string;
    reaction: string;
    score?: number;
    evalResult?: EvalResponse;
  }
): Promise<void> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('[saveYLTurnAction] Not authenticated');

  const result = await persistMessages([
    {
      sessionId,
      userId: user.id,
      role: 'user',
      msgType: 'user_audio',
      contentText: turn.transcript,
      contentJson: {
        cue: turn.cue,
        cue_index: turn.cueIndex,
        transcribed: turn.transcript,
      },
    },
    {
      sessionId,
      userId: user.id,
      role: 'bob',
      msgType: 'yl_cue',
      contentText: turn.reaction,
      contentJson: {
        reaction: turn.reaction,
        cue_index: turn.cueIndex,
        ...(turn.evalResult ? { eval: turn.evalResult } : {}),
      },
    },
  ]);

  if ('error' in result) {
    throw new Error(`[saveYLTurnAction] Failed to save turn: ${result.error}`);
  }
}

const YLTurnEvalSchema = EvalResponseSchema.extend({
  reaction: z.string(),
});

export async function evaluateYLTurnAction(input: {
  mode: ModeKey;
  audioBase64: string;
  mimeType: string;
  audioDuration: number;
  cue: string;
  sessionId: string;
  cueIndex: number;
}): Promise<YLTurnEvalResult> {
  const { exam, part } = parseYLMode(input.mode);

  if (input.audioDuration <= 0.3) {
    console.info(
      `[evaluateYLTurnAction] Audio too short (${input.audioDuration}s) — returning score 0`
    );
    return {
      score: 0,
      score_max: 15,
      cefr_band: 'a1',
      feedback:
        '¡Casi! Vamos a intentarlo de nuevo juntos. Habla un poquito más.',
      band_per_criterion: {
        grammar_and_vocabulary: 0,
        pronunciation: 0,
        interactive_communication: 0,
      },
      reaction: "Let's try that again together! 🌟",
    };
  }

  const ai = getAiClient();

  const transcribeResponse = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [
      {
        role: 'user',
        parts: [
          { text: `Transcribe exactly what the child says in English. Output only the transcription, nothing else. If nothing was said, output "(silence)".` },
          { inlineData: { mimeType: input.mimeType, data: input.audioBase64 } },
        ],
      },
    ],
  });
  const transcribed = (transcribeResponse.text ?? '(silence)').trim();

  const sharedParams = {
    USER_TRANSCRIPT: transcribed,
    QUESTION: input.cue,
    EXAMINER_CUE: input.cue,
    STORY_BEAT: input.cue,
    DIFFERENCE: input.cue,
    PERSONAL_QUESTION: input.cue,
    CUE: input.cue,
    SCENE_QUESTION: input.cue,
    AUDIO_DURATION_SECONDS: input.audioDuration,
  } as const;
  const evalPrompt = await getPrompt(evaluationKey(exam, part), sharedParams);
  const reactionPrompt = await getPrompt(reactionKey(exam, part), sharedParams);

  const [evalResponse, reactionResponse] = await Promise.all([
    ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: evalPrompt }] }],
      config: { responseMimeType: 'application/json' },
    }),
    ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: reactionPrompt }] }],
    }),
  ]);

  const reaction = (reactionResponse.text ?? '').trim() || '¡Muy bien! 🌟';

  const raw = evalResponse.text ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('[evaluateYLTurnAction] Failed to parse eval JSON:', raw);
    return {
      score: 5,
      score_max: 15,
      cefr_band: 'a1',
      feedback: '¡Buen intento! Sigue practicando.',
      reaction,
    };
  }

  const result = EvalResponseSchema.safeParse(parsed);
  if (!result.success) {
    console.error('[evaluateYLTurnAction] Invalid eval schema:', result.error.message);
    return {
      score: 5,
      score_max: 15,
      cefr_band: 'a1',
      feedback: '¡Buen intento! Sigue practicando.',
      reaction,
    };
  }

  return { ...result.data, reaction };
}

export async function evaluateYLFinalAction(input: {
  sessionId: string;
  mode: ModeKey;
  turnsCount: number;
}): Promise<EvalResponse> {
  const { exam, part } = parseYLMode(input.mode);
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('[evaluateYLFinalAction] Not authenticated');

  const { data: messages } = await supabase
    .from('bob_messages')
    .select('content_text, content_json, role, msg_type')
    .eq('session_id', input.sessionId)
    .eq('role', 'user')
    .order('created_at', { ascending: true });

  const transcript = (messages ?? [])
    .map(
      (m, i) =>
        `Turn ${i + 1}: ${(m.content_text as string) ?? (m.content_json as Record<string, unknown>)?.transcribed ?? ''}`
    )
    .join('\n');

  const ai = getAiClient();
  const promptText = await getPrompt(evaluationKey(exam, part), {
    USER_TRANSCRIPT: transcript,
    QUESTION: `Full session — ${input.turnsCount} turns`,
    STORY_BEAT: `Full session — ${input.turnsCount} turns`,
    DIFFERENCE: `Full session — ${input.turnsCount} turns`,
    AUDIO_DURATION_SECONDS: 30,
  });

  const response = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    config: { responseMimeType: 'application/json' },
  });

  const raw = response.text ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('[evaluateYLFinalAction] Gemini returned invalid JSON');
  }

  const result = EvalResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`[evaluateYLFinalAction] Invalid eval schema: ${result.error.message}`);
  }

  const evalResult = result.data;

  await persistMessage({
    sessionId: input.sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: { ...evalResult, is_final: true },
  });

  return evalResult;
}

// Server-action files only allow async function exports; this wraps the
// re-export from messages.ts as a thin async function to satisfy that constraint.
import { getMessagesAction } from '@/actions/messages';

export async function getSessionMessagesAction(sessionId: string) {
  return getMessagesAction(sessionId);
}
