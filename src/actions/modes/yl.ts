'use server';

import { z } from 'zod';
import { getAiClient } from '../_shared';
import { MODELS } from '@/lib/models';
import { EvalResponseSchema, type EvalResponse, type ModeKey } from '@/lib/types/practice';
import { YLPlanSchema, type YLPlan, type YLExam, type YLTurnEvalResult } from '@/lib/types/yl';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { createSupabaseServer } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// T3.2 — startYLSessionAction
// Creates a bob_sessions row and generates the YL session plan via Gemini.
// ---------------------------------------------------------------------------

export async function startYLSessionAction(input: {
  mode: ModeKey;
}): Promise<{ sessionId: string; plan: YLPlan }> {
  const { exam, part } = parseYLMode(input.mode);

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('[startYLSessionAction] Not authenticated');

  // Map part numbers to readable titles
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
  console.log(`[YL][${input.mode}] start — creating session`);

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

  console.log(`[YL][${input.mode}] session ${session.id} created in ${Date.now() - t0}ms — generating plan`);

  // Fetch the last 20 plans of this user+mode to discourage repetition.
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

  // Generate the session plan
  const t1 = Date.now();
  const plan = await generateYLContentAction(exam, part, { avoidList });
  console.log(`[YL][${input.mode}] plan ready in ${Date.now() - t1}ms (cues=${plan.cues?.length ?? 0}, images=${plan.image_prompts?.length ?? 0})`);

  // Persist the plan in the session so future generations know what to avoid
  await supabase.from('bob_sessions').update({ plan_json: plan }).eq('id', session.id);

  return { sessionId: session.id as string, plan };
}

// ---------------------------------------------------------------------------
// Persist scene image(s) so reopening the session shows them without
// regenerating from Gemini. Idempotent per (session, image_index).
// ---------------------------------------------------------------------------

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

  await supabase.from('bob_messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role: 'bob' as const,
    msg_type: 'image_scene',
    content_text: null,
    content_json: { image_data_uri: imageDataUri, image_index: imageIndex },
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
  await supabase.from('bob_messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role: 'bob' as const,
    msg_type: 'evaluation',
    content_text: null,
    content_json: { ...evalResult, is_final: true },
  });
}

// ---------------------------------------------------------------------------
// TTS cache per (session, cue_text). First call hits Gemini and persists the
// audio in bob_messages; subsequent calls return the cached blob.
// ---------------------------------------------------------------------------

import { generateSpeechAction } from '@/actions/gemini';

export async function getOrCreateCueAudioAction(
  sessionId: string,
  cueText: string
): Promise<{ data: string; mimeType: string }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('[getOrCreateCueAudioAction] Not authenticated');

  // Look up cached audio
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

  // Cache miss → call Gemini and persist
  const { data, mimeType } = await generateSpeechAction(cueText);

  await supabase.from('bob_messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role: 'bob' as const,
    msg_type: 'yl_tts',
    content_text: cueText,
    content_json: { audio_b64: data, mime: mimeType },
  });

  return { data, mimeType };
}

// ---------------------------------------------------------------------------
// T3.3 — generateYLContentAction
// Calls Gemini to produce the YL session plan (cues + image prompts if needed).
// For parts that require images, also returns image_prompts to pass to
// generateYLImagesAction.
// ---------------------------------------------------------------------------

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

  // The seeded generation prompts use mixed key names across exam parts
  // (examiner_cues vs cues, image_prompt vs image_prompts, etc.). Normalize
  // to the canonical YLPlanSchema shape before validating.
  const p = (parsed ?? {}) as Record<string, unknown>;

  // Pointing-shape detection (Starters P1 / Movers P1 click activity)
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

// ---------------------------------------------------------------------------
// T3.4 — generateYLImagesAction
// Generates N images in parallel using the YL image_gen prompt.
// For story parts (3), passes CHARACTER_DESCRIPTION for visual consistency.
// ---------------------------------------------------------------------------

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

      // Retry once if the model returns no image data (occasional empty
      // response or safety filter trip). After two empties → return a
      // transparent placeholder so the rest of the activity still works.
      for (let attempt = 0; attempt < 2; attempt++) {
        const tImg = Date.now();
        console.log(`[YL][${exam}_part${part}] image ${idx + 1}/${imagePrompts.length} sent to Gemini (attempt ${attempt + 1})`);
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
      // 1×1 transparent PNG placeholder so the activity continues
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    })
  );
}

// ---------------------------------------------------------------------------
// T3.5 — saveYLTurnAction
// Persists 2 bob_messages rows per turn:
//   - role='user'  msg_type='user_audio'  → transcript + cue context
//   - role='bob'   msg_type='yl_cue'      → reaction
// ---------------------------------------------------------------------------

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

  const userRow = {
    session_id: sessionId,
    user_id: user.id,
    role: 'user' as const,
    msg_type: 'user_audio',
    content_text: turn.transcript,
    content_json: {
      cue: turn.cue,
      cue_index: turn.cueIndex,
      transcribed: turn.transcript,
    },
  };

  const bobRow = {
    session_id: sessionId,
    user_id: user.id,
    role: 'bob' as const,
    msg_type: 'yl_cue',
    content_text: turn.reaction,
    content_json: {
      reaction: turn.reaction,
      cue_index: turn.cueIndex,
      ...(turn.evalResult ? { eval: turn.evalResult } : {}),
    },
  };

  const { error } = await supabase
    .from('bob_messages')
    .insert([userRow, bobRow]);

  if (error) {
    throw new Error(`[saveYLTurnAction] Failed to save turn: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// T3.6 — evaluateYLTurnAction
// Evaluates one YL turn.
// HARD RULE: audioDuration ≤ 0.3s → score 0 immediately.
// ---------------------------------------------------------------------------

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

  // HARD RULE: reject micro-recordings silently with a gentle message
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

  // Step 1: Transcribe the audio
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

  // Step 2: Evaluate + get examiner reaction
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

  // Run evaluation and reaction in parallel
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
    // Fallback on parse error — don't crash the turn
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

// ---------------------------------------------------------------------------
// T3.6 — evaluateYLFinalAction
// Holistic evaluation over all turns. Persists a final evaluation message.
// ---------------------------------------------------------------------------

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

  // Fetch all user messages for this session
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
    AUDIO_DURATION_SECONDS: 30, // safe fallback for final eval
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

  // Persist final evaluation row
  await supabase.from('bob_messages').insert({
    session_id: input.sessionId,
    user_id: user.id,
    role: 'bob',
    msg_type: 'evaluation',
    content_json: { ...evalResult, is_final: true },
  });

  return evalResult;
}

// ---------------------------------------------------------------------------
// T3.7 — getSessionMessagesAction
// Returns all messages for a session ordered by created_at.
// Note: getMessagesAction is exported from src/actions/messages.ts.
// Server-action files only allow async function exports, so the alias is
// declared here as a thin async wrapper instead of a re-export.
// ---------------------------------------------------------------------------

import { getMessagesAction } from '@/actions/messages';

export async function getSessionMessagesAction(sessionId: string) {
  return getMessagesAction(sessionId);
}
