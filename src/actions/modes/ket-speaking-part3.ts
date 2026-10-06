'use server';

import { after } from 'next/server';
import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { evaluateKetAudio } from '@/lib/speaking/ket-evaluate';
import {
  KET_AUDIO_MIME,
  PICTURE_FEEDBACK_KIND,
  PICTURE_PLAN_KIND,
  type KetSpeakingFeedback,
  type PicturePlan,
} from '@/lib/speaking/ket-speaking';
import { generateSpeechAction } from '@/actions/gemini';
import { generateYLImagesParallelAction } from '@/actions/modes/yl';
import { addPooledExercises, claimPooledExercise, countPooledExercises } from '@/lib/exercise-pool';
import { MODELS } from '@/lib/models';

const POOL_MODE = 'cambridge_ket_part3';

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


export interface PictureDescMedia {
  instruction_audio_b64: string;
  instruction_audio_mime: string;
  image_url: string;
}

export type PictureDescFeedback = KetSpeakingFeedback;

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
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

export async function buildPicturePayload(): Promise<PicturePoolPayload | null> {
  const parsed = await generatePlanText();
  if (!parsed) return null;

  const [imageUrls, audioResult] = await Promise.all([
    generateYLImagesParallelAction('movers', 3, [parsed.image_prompt], `pool-${crypto.randomUUID()}`, undefined, 'scene').catch(() => ['']),
    generateSpeechAction(parsed.instruction).catch(() => ({ data: '', mimeType: KET_AUDIO_MIME })),
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
    return;
  }
}

export async function generateKETPictureDescPlanAction(): Promise<PicturePlan | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

  after(() => replenishPicturePool(3));

  const pooled = await claimPooledExercise<PicturePoolPayload>(POOL_MODE);
  if (pooled) return pooled;

  const parsed = await generatePlanText(userId);
  if (!parsed) return { error: 'Unexpected model response' };
  return parsed;
}

export async function generateKETPictureDescMediaAction(input: {
  instruction: string;
  image_prompt: string;
}): Promise<PictureDescMedia> {
  const [imageUrls, audioResult] = await Promise.all([
    generateYLImagesParallelAction('movers', 3, [input.image_prompt], crypto.randomUUID(), undefined, 'scene').catch(() => ['']),
    generateSpeechAction(input.instruction).catch(() => ({ data: '', mimeType: KET_AUDIO_MIME })),
  ]);
  return {
    instruction_audio_b64: audioResult.data,
    instruction_audio_mime: audioResult.mimeType,
    image_url: imageUrls[0] ?? '',
  };
}

export async function evaluateKETPictureDescAction(input: {
  sessionId?: string;
  plan: PicturePlan;
  audioBase64: string;
  audioMime: string;
}): Promise<{ feedback: PictureDescFeedback; sessionId: string } | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

  const evaluated = await evaluateKetAudio({
    promptKey: 'cambridge_ket_part3_a2_evaluation',
    replacements: { '{SCENE_DESCRIPTION}': input.plan.scene_description, '{TRANSCRIPT}': '[audio attached]' },
    audioBase64: input.audioBase64,
    audioMime: input.audioMime,
    userId,
  });
  if (!evaluated.ok) return { error: evaluated.code };

  const storedPlan = {
    scene_description: input.plan.scene_description,
    instruction: input.plan.instruction,
    image_prompt: input.plan.image_prompt,
    image_url: input.plan.image_url ?? '',
  };
  const completed = await completeActivity({
    mode: POOL_MODE,
    sessionId: input.sessionId,
    plan: { kind: PICTURE_PLAN_KIND, ...storedPlan },
    answers: [{ kind: 'speaking_answer', question: input.plan.instruction }],
    evaluation: { kind: PICTURE_FEEDBACK_KIND, ...evaluated.data, rubric: evaluated.data.rubric ?? null },
  });
  if (!completed.ok) return { error: completed.code };

  return { feedback: evaluated.data, sessionId: completed.data.sessionId };
}
