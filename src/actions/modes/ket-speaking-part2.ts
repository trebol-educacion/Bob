'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { generateSpeechAction } from '@/actions/gemini';
import { generateYLImagesParallelAction } from '@/actions/modes/yl';
import { MODELS } from '@/lib/models';

const GenerationSchema = z.object({
  hobby: z.string(),
  instruction: z.string(),
  bullet_points: z.array(z.string()).min(2).max(4),
  image_prompt: z.string(),
});

const EvaluationSchema = z.object({
  understood: z.boolean(),
  highlights: z.array(z.string()),
  suggestions: z.array(z.string()),
  model_answer: z.string().nullable().optional(),
});

export interface HobbyTalkPrompt {
  sessionId: string;
  userId: string;
  hobby: string;
  instruction: string;
  instruction_audio_b64: string;
  instruction_audio_mime: string;
  bullet_points: string[];
  image_url: string;
}

/** Plan without media — returned by the fast first-phase action. */
export interface HobbyTalkPlan {
  sessionId: string;
  userId: string;
  hobby: string;
  instruction: string;
  bullet_points: string[];
  image_prompt: string;
}

/** Media (TTS + image) loaded in the background after the plan renders. */
export interface HobbyTalkMedia {
  instruction_audio_b64: string;
  instruction_audio_mime: string;
  image_url: string;
}

export interface HobbyTalkFeedback {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  model_answer: string | null;
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try { return schema.parse(JSON.parse(raw)); } catch { return null; }
}

function fallbackFeedback(): HobbyTalkFeedback {
  return { understood: false, highlights: [], suggestions: ['Try again — we could not process your response.'], model_answer: null };
}

/**
 * Phase 1 — fast (~1.5s): generates text only (hobby, instruction, bullets,
 * image prompt). The component renders immediately and loads TTS + image in
 * the background via generateKETHobbyTalkMediaAction.
 */
export async function generateKETHobbyTalkPlanAction(input: {
  sessionId?: string;
}): Promise<HobbyTalkPlan | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({ mode: 'cambridge_ket_part2', title: 'KET Speaking Part 2 — Talk About a Hobby' });
    if (!result.data) return { error: result.error ?? 'Could not create session' };
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    userId = user.id;
  }

  const generationPrompt = await getPrompt('cambridge_ket_part2_a2_generation').catch(() => null);
  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_part2_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!isOk(geminiResult)) return { error: 'Could not generate exercise' };

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);
  if (!parsed) return { error: 'Unexpected model response' };

  persistMessage({
    sessionId: sessionId!, userId: userId!, role: 'bob', msgType: 'text',
    contentText: null,
    contentJson: { kind: 'hobby_talk_prompt', hobby: parsed.hobby, instruction: parsed.instruction, bullet_points: parsed.bullet_points, image_prompt: parsed.image_prompt, image_url: '' },
  }).catch(() => undefined);

  return {
    sessionId: sessionId!, userId: userId!,
    hobby: parsed.hobby,
    instruction: parsed.instruction,
    bullet_points: parsed.bullet_points,
    image_prompt: parsed.image_prompt,
  };
}

/** Phase 2 — generates TTS + image in parallel (~7s, cached). */
export async function generateKETHobbyTalkMediaAction(input: {
  instruction: string;
  image_prompt: string;
  sessionId: string;
}): Promise<HobbyTalkMedia> {
  const [imageUrls, audioResult] = await Promise.all([
    generateYLImagesParallelAction('movers', 2, [input.image_prompt], input.sessionId, undefined, 'scene').catch(() => ['']),
    generateSpeechAction(input.instruction).catch(() => ({ data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' })),
  ]);
  return {
    instruction_audio_b64: audioResult.data,
    instruction_audio_mime: audioResult.mimeType,
    image_url: imageUrls[0] ?? '',
  };
}

/** Legacy full action (kept for compatibility). */
export async function generateKETHobbyTalkAction(input: {
  sessionId?: string;
}): Promise<HobbyTalkPrompt | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({ mode: 'cambridge_ket_part2', title: 'KET Speaking Part 2 — Talk About a Hobby' });
    if (!result.data) return { error: result.error ?? 'Could not create session' };
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    userId = user.id;
  }

  const generationPrompt = await getPrompt('cambridge_ket_part2_a2_generation').catch(() => null);
  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_part2_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!isOk(geminiResult)) return { error: 'Could not generate exercise' };

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);
  if (!parsed) return { error: 'Unexpected model response' };

  const [imageUrls, audioResult] = await Promise.all([
    generateYLImagesParallelAction('movers', 2, [parsed.image_prompt], sessionId!, undefined, 'scene').catch(() => ['']),
    generateSpeechAction(parsed.instruction).catch(() => ({ data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' })),
  ]);

  persistMessage({
    sessionId: sessionId!, userId: userId!, role: 'bob', msgType: 'text',
    contentText: null,
    contentJson: { kind: 'hobby_talk_prompt', hobby: parsed.hobby, instruction: parsed.instruction, bullet_points: parsed.bullet_points, image_url: imageUrls[0] ?? '' },
  }).catch(() => undefined);

  return {
    sessionId: sessionId!, userId: userId!,
    hobby: parsed.hobby,
    instruction: parsed.instruction,
    instruction_audio_b64: audioResult.data,
    instruction_audio_mime: audioResult.mimeType,
    bullet_points: parsed.bullet_points,
    image_url: imageUrls[0] ?? '',
  };
}

export async function evaluateKETHobbyTalkAction(input: {
  sessionId: string;
  userId: string;
  audioBase64: string;
  audioMime: string;
  hobby: string;
  bullet_points: string[];
}): Promise<HobbyTalkFeedback | { error: string }> {
  const evalPromptTemplate = await getPrompt('cambridge_ket_part2_a2_evaluation').catch(() => null);
  if (!evalPromptTemplate) return fallbackFeedback();

  const bulletSummary = input.bullet_points.map((b, i) => `${i + 1}. ${b}`).join('; ');
  const prompt = evalPromptTemplate
    .replace('{HOBBY}', input.hobby)
    .replace('{BULLET_POINTS}', bulletSummary)
    .replace('{TRANSCRIPT}', '[audio attached]');

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_part2_a2_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId: input.userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
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

  const feedback: HobbyTalkFeedback = {
    understood: parsed.understood,
    highlights: parsed.highlights,
    suggestions: parsed.suggestions,
    model_answer: parsed.model_answer ?? null,
  };

  persistMessage({
    sessionId: input.sessionId, userId: input.userId, role: 'bob', msgType: 'evaluation',
    contentText: null,
    contentJson: { kind: 'hobby_talk_feedback', ...feedback, is_final: true },
  }).catch(() => undefined);

  return feedback;
}
