'use server';

import { z } from 'zod';
import { getAiClient } from '../_shared';
import { MODELS } from '@/lib/models';
import { EvalResponseSchema, type EvalResponse, type ModeKey } from '@/lib/types/practice';
import { YLPlanSchema, type YLPlan, type YLExam, type YLTurnEvalResult } from '@/lib/types/yl';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { createSupabaseServer } from '@/lib/supabase/server';
import { generateImageAction } from '@/actions/gemini';

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

  // Generate the session plan
  const plan = await generateYLContentAction(exam, part);

  return { sessionId: session.id as string, plan };
}

// ---------------------------------------------------------------------------
// T3.3 — generateYLContentAction
// Calls Gemini to produce the YL session plan (cues + image prompts if needed).
// For parts that require images, also returns image_prompts to pass to
// generateYLImagesAction.
// ---------------------------------------------------------------------------

export async function generateYLContentAction(
  exam: YLExam,
  part: number
): Promise<YLPlan> {
  const ai = getAiClient();
  const promptText = await getPrompt(generationKey(exam, part));

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

  const result = YLPlanSchema.safeParse(parsed);
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

  return Promise.all(
    imagePrompts.map(async (imagePrompt) => {
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
      // generateImageAction expects the raw prompt text for Gemini Image model.
      // It internally wraps it through generic_image_b1_image_gen which adds
      // the illustration style — use the raw imagePrompt + style suffix instead.
      return generateImageAction(fullPrompt);
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
  const evalPrompt = await getPrompt(evaluationKey(exam, part), {
    USER_TRANSCRIPT: transcribed,
    QUESTION: input.cue,
    STORY_BEAT: input.cue,
    DIFFERENCE: input.cue,
    AUDIO_DURATION_SECONDS: input.audioDuration,
  });

  const reactionPrompt = await getPrompt(reactionKey(exam, part), {
    USER_TRANSCRIPT: transcribed,
    QUESTION: input.cue,
    STORY_BEAT: input.cue,
    DIFFERENCE: input.cue,
  });

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
