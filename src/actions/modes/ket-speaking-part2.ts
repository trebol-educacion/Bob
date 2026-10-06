'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { generateSpeechAction } from '@/actions/gemini';
import { generateYLImagesParallelAction } from '@/actions/modes/yl';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { evaluateKetAudio } from '@/lib/speaking/ket-evaluate';
import {
  HOBBY_FEEDBACK_KIND,
  HOBBY_PLAN_KIND,
  HobbyPlanSchema,
  KET_AUDIO_MIME,
  type HobbyPlan,
  type KetSpeakingFeedback,
} from '@/lib/speaking/ket-speaking';
import { MODELS } from '@/lib/models';

const HOBBY_MODE = 'cambridge_ket_part2';

export interface HobbyTalkMedia {
  instruction_audio_b64: string;
  instruction_audio_mime: string;
  image_url: string;
}

export type HobbyTalkFeedback = KetSpeakingFeedback;

function parsePlan(raw: string): HobbyPlan | null {
  try {
    const parsed = HobbyPlanSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function generateKETHobbyTalkPlanAction(): Promise<HobbyPlan | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

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

  const plan = parsePlan(geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
  return plan ?? { error: 'Unexpected model response' };
}

export async function generateKETHobbyTalkMediaAction(input: {
  instruction: string;
  image_prompt: string;
}): Promise<HobbyTalkMedia> {
  const [imageUrls, audioResult] = await Promise.all([
    generateYLImagesParallelAction('movers', 2, [input.image_prompt], crypto.randomUUID(), undefined, 'scene').catch(() => ['']),
    generateSpeechAction(input.instruction).catch(() => ({ data: '', mimeType: KET_AUDIO_MIME })),
  ]);
  return {
    instruction_audio_b64: audioResult.data,
    instruction_audio_mime: audioResult.mimeType,
    image_url: imageUrls[0] ?? '',
  };
}

export async function evaluateKETHobbyTalkAction(input: {
  sessionId?: string;
  plan: HobbyPlan;
  audioBase64: string;
  audioMime: string;
}): Promise<{ feedback: HobbyTalkFeedback; sessionId: string } | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

  const evaluated = await evaluateKetAudio({
    promptKey: 'cambridge_ket_part2_a2_evaluation',
    replacements: {
      '{HOBBY}': input.plan.hobby,
      '{BULLET_POINTS}': input.plan.bullet_points.map((b, i) => `${i + 1}. ${b}`).join('; '),
      '{TRANSCRIPT}': '[audio attached]',
    },
    audioBase64: input.audioBase64,
    audioMime: input.audioMime,
    userId,
  });
  if (!evaluated.ok) return { error: evaluated.code };

  const completed = await completeActivity({
    mode: HOBBY_MODE,
    sessionId: input.sessionId,
    plan: { kind: HOBBY_PLAN_KIND, ...input.plan },
    answers: [{ kind: 'speaking_answer', question: input.plan.instruction }],
    evaluation: { kind: HOBBY_FEEDBACK_KIND, ...evaluated.data, rubric: evaluated.data.rubric ?? null },
  });
  if (!completed.ok) return { error: completed.code };

  return { feedback: evaluated.data, sessionId: completed.data.sessionId };
}
