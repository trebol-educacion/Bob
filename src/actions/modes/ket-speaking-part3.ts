'use server';

import { after } from 'next/server';
import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { generateSpeechAction } from '@/actions/gemini';
import { generateYLImagesParallelAction } from '@/actions/modes/yl';
import { addPooledExercises, claimPooledExercise, countPooledExercises } from '@/lib/exercise-pool';
import { MODELS } from '@/lib/models';

const POOL_MODE = 'cambridge_ket_part3';
const DEFAULT_AUDIO_MIME = 'audio/L16;codec=pcm;rate=24000';

/** Fully pre-generated exercise: text, image and instruction audio all ready. */
export type PicturePoolPayload = {
  scene_description: string;
  instruction: string;
  image_prompt: string;
  image_url: string;
  instruction_audio_b64: string;
  instruction_audio_mime: string;
};

const GenerationSchema = z.object({
  scene_description: z.string(),
  instruction: z.string(),
  image_prompt: z.string(),
});

const RubricSchema = z
  .object({
    task_coverage: z.number().int().min(0).max(4),
    grammar:       z.number().int().min(0).max(4),
    vocabulary:    z.number().int().min(0).max(4),
    fluency:       z.number().int().min(0).max(4),
  })
  .optional();

const EvaluationSchema = z.object({
  understood:   z.boolean(),
  highlights:   z.array(z.string()),
  suggestions:  z.array(z.string()),
  model_answer: z.string().nullable().optional(),
  rubric:       RubricSchema,
});

export interface PictureDescPrompt {
  sessionId: string;
  userId: string;
  scene_description: string;
  instruction: string;
  instruction_audio_b64: string;
  instruction_audio_mime: string;
  image_url: string;
}

/**
 * Plan returned by the fast first-phase action. When served from the
 * pre-generation pool it also carries the ready media (image + audio), so the
 * component can skip the live media phase entirely.
 */
export interface PictureDescPlan {
  sessionId: string;
  userId: string;
  scene_description: string;
  instruction: string;
  image_prompt: string;
  image_url?: string;
  instruction_audio_b64?: string;
  instruction_audio_mime?: string;
}

/** Media (TTS + image) loaded in the background after the plan renders. */
export interface PictureDescMedia {
  instruction_audio_b64: string;
  instruction_audio_mime: string;
  image_url: string;
}

export interface PictureDescFeedback {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  model_answer: string | null;
  rubric?: z.infer<typeof RubricSchema>;
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try { return schema.parse(JSON.parse(raw)); } catch { return null; }
}

function fallbackFeedback(): PictureDescFeedback {
  return { understood: false, highlights: [], suggestions: ['Try again — we could not process your response.'], model_answer: null };
}

async function generatePlanText(userId?: string): Promise<z.infer<typeof GenerationSchema> | null> {
  const generationPrompt = await getPrompt('cambridge_ket_part3_a2_generation').catch(() => null);
  if (!generationPrompt) return null;

  let parsed: z.infer<typeof GenerationSchema> | null = null;
  for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
    const geminiResult = await callGemini(
      { promptKey: 'cambridge_ket_part3_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
      (ai) => ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
    );
    if (!isOk(geminiResult)) continue;
    const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    parsed = safeParse(GenerationSchema, rawText);
  }
  return parsed;
}

/**
 * Builds one fully-ready pooled exercise: text plan, a reusable scene image and
 * the instruction audio. The image is generated the same way the live path
 * produces it, so its URL is reusable by any future session. Never throws;
 * returns null when text generation fails and empty media strings when image or
 * audio generation fails.
 */
export async function buildPicturePayload(): Promise<PicturePoolPayload | null> {
  const parsed = await generatePlanText();
  if (!parsed) return null;

  const [imageUrls, audioResult] = await Promise.all([
    generateYLImagesParallelAction('movers', 3, [parsed.image_prompt], `pool-${crypto.randomUUID()}`, undefined, 'scene').catch(() => ['']),
    generateSpeechAction(parsed.instruction).catch(() => ({ data: '', mimeType: DEFAULT_AUDIO_MIME })),
  ]);

  return {
    scene_description: parsed.scene_description,
    instruction: parsed.instruction,
    image_prompt: parsed.image_prompt,
    image_url: imageUrls[0] ?? '',
    instruction_audio_b64: audioResult.data,
    instruction_audio_mime: audioResult.mimeType,
  };
}

/**
 * Best-effort top-up of the pre-generation pool to `target` ready exercises.
 * Builds payloads sequentially to avoid hammering the upstream APIs. Safe to run
 * in the background via `after()`; failures are swallowed.
 */
export async function replenishPicturePool(target = 3): Promise<void> {
  try {
    const have = await countPooledExercises(POOL_MODE);
    const need = Math.max(0, target - have);
    if (need === 0) return;

    const payloads: PicturePoolPayload[] = [];
    for (let i = 0; i < need; i++) {
      const payload = await buildPicturePayload();
      if (payload) payloads.push(payload);
    }
    await addPooledExercises(POOL_MODE, payloads);
  } catch {
    // Replenishment is best-effort; the live-generation fallback always works.
  }
}

/**
 * Phase 1 — fast: tries the pre-generation pool first. A pooled hit returns the
 * full exercise (image + audio already generated) for instant entry. On a miss
 * it generates the text-only plan live (~1.5s) and the component loads TTS +
 * image in the background via generateKETPictureDescMediaAction. In both cases
 * the pool is topped up in the background after the response is sent.
 */
export async function generateKETPictureDescPlanAction(input: {
  sessionId?: string;
}): Promise<PictureDescPlan | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({ mode: 'cambridge_ket_part3', title: 'Speaking Part 3 — Describe the Picture' });
    if (!result.data) return { error: result.error ?? 'Could not create session' };
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    userId = user.id;
  }

  after(() => replenishPicturePool(3));

  const pooled = await claimPooledExercise<PicturePoolPayload>(POOL_MODE);
  if (pooled) {
    persistMessage({
      sessionId: sessionId!, userId: userId!, role: 'bob', msgType: 'text',
      contentText: null,
      contentJson: { kind: 'picture_desc_prompt', scene_description: pooled.scene_description, instruction: pooled.instruction, image_prompt: pooled.image_prompt, image_url: pooled.image_url },
    }).catch(() => undefined);

    return {
      sessionId: sessionId!, userId: userId!,
      scene_description: pooled.scene_description,
      instruction: pooled.instruction,
      image_prompt: pooled.image_prompt,
      image_url: pooled.image_url,
      instruction_audio_b64: pooled.instruction_audio_b64,
      instruction_audio_mime: pooled.instruction_audio_mime,
    };
  }

  const parsed = await generatePlanText(userId);
  if (!parsed) return { error: 'Unexpected model response' };

  persistMessage({
    sessionId: sessionId!, userId: userId!, role: 'bob', msgType: 'text',
    contentText: null,
    contentJson: { kind: 'picture_desc_prompt', scene_description: parsed.scene_description, instruction: parsed.instruction, image_prompt: parsed.image_prompt, image_url: '' },
  }).catch(() => undefined);

  return {
    sessionId: sessionId!, userId: userId!,
    scene_description: parsed.scene_description,
    instruction: parsed.instruction,
    image_prompt: parsed.image_prompt,
  };
}

/** Phase 2 — generates TTS + image in parallel (~7s, cached). */
export async function generateKETPictureDescMediaAction(input: {
  instruction: string;
  image_prompt: string;
  sessionId: string;
}): Promise<PictureDescMedia> {
  const [imageUrls, audioResult] = await Promise.all([
    generateYLImagesParallelAction('movers', 3, [input.image_prompt], input.sessionId, undefined, 'scene').catch(() => ['']),
    generateSpeechAction(input.instruction).catch(() => ({ data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' })),
  ]);
  return {
    instruction_audio_b64: audioResult.data,
    instruction_audio_mime: audioResult.mimeType,
    image_url: imageUrls[0] ?? '',
  };
}

/** Legacy full action (kept for compatibility). */
export async function generateKETPictureDescAction(input: {
  sessionId?: string;
}): Promise<PictureDescPrompt | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({ mode: 'cambridge_ket_part3', title: 'Speaking Part 3 — Describe the Picture' });
    if (!result.data) return { error: result.error ?? 'Could not create session' };
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    userId = user.id;
  }

  const generationPrompt = await getPrompt('cambridge_ket_part3_a2_generation').catch(() => null);
  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  let parsed: z.infer<typeof GenerationSchema> | null = null;
  for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
    const geminiResult = await callGemini(
      { promptKey: 'cambridge_ket_part3_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
      (ai) => ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
    );
    if (!isOk(geminiResult)) continue;
    const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    parsed = safeParse(GenerationSchema, rawText);
  }

  if (!parsed) return { error: 'Unexpected model response' };

  const [imageUrls, audioResult] = await Promise.all([
    generateYLImagesParallelAction('movers', 3, [parsed.image_prompt], sessionId!, undefined, 'scene').catch(() => ['']),
    generateSpeechAction(parsed.instruction).catch(() => ({ data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' })),
  ]);

  persistMessage({
    sessionId: sessionId!, userId: userId!, role: 'bob', msgType: 'text',
    contentText: null,
    contentJson: { kind: 'picture_desc_prompt', scene_description: parsed.scene_description, instruction: parsed.instruction, image_url: imageUrls[0] ?? '' },
  }).catch(() => undefined);

  return {
    sessionId: sessionId!, userId: userId!,
    scene_description: parsed.scene_description,
    instruction: parsed.instruction,
    instruction_audio_b64: audioResult.data,
    instruction_audio_mime: audioResult.mimeType,
    image_url: imageUrls[0] ?? '',
  };
}

export async function evaluateKETPictureDescAction(input: {
  sessionId: string;
  userId: string;
  audioBase64: string;
  audioMime: string;
  scene_description: string;
}): Promise<PictureDescFeedback | { error: string }> {
  const evalPromptTemplate = await getPrompt('cambridge_ket_part3_a2_evaluation').catch(() => null);
  if (!evalPromptTemplate) return fallbackFeedback();

  const prompt = evalPromptTemplate
    .replace('{SCENE_DESCRIPTION}', input.scene_description)
    .replace('{TRANSCRIPT}', '[audio attached]');

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_part3_a2_evaluation', model: MODELS.FLASH_LITE, userId: input.userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: input.audioMime, data: input.audioBase64 } },
        ],
      }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!isOk(geminiResult)) return fallbackFeedback();

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(EvaluationSchema, rawText);
  if (!parsed) return fallbackFeedback();

  const feedback: PictureDescFeedback = {
    understood: parsed.understood,
    highlights: parsed.highlights,
    suggestions: parsed.suggestions,
    model_answer: parsed.model_answer ?? null,
    rubric: parsed.rubric,
  };

  persistMessage({
    sessionId: input.sessionId, userId: input.userId, role: 'bob', msgType: 'evaluation',
    contentText: null,
    contentJson: { kind: 'picture_desc_feedback', ...feedback, rubric: parsed.rubric ?? null, is_final: true },
  }).catch(() => undefined);

  return feedback;
}
