'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { MODELS } from '@/lib/models';
import { bankStamp, pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { KetPictureStoryPlanSchema, type KetStoryScene } from '@/lib/bank-plans/ket-writing-part7';

const KET_PICTURE_STORY_PART = 'ket_writing_part7';

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

export type StoryScene = Omit<KetStoryScene, 'image_url'>;

export interface StorySceneWithImage extends StoryScene {
  image_url: string;
}

export interface PictureStoryPlan {
  story_premise: string;
  scenes: StorySceneWithImage[];
  framing_text: string;
  bank_group_id: string;
}

export interface PictureStoryFeedback {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  model_answer: string | null;
  rubric?: z.infer<typeof RubricSchema>;
}

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try { return schema.parse(JSON.parse(raw)); } catch { return null; }
}

const FRAMING_FALLBACK = 'Look at the three pictures. They tell a story. Write the story in about 35 words or more.';

/** Reads one pregenerated picture story with its three scene images from the bank; no model call and no session row. */
export async function generateKETPictureStoryPlanAction(): Promise<ActionResult<PictureStoryPlan>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: KET_PICTURE_STORY_PART,
    skill: 'writing',
    schema: KetPictureStoryPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;

  const framingText = await getPrompt('cambridge_ket_writing_part7_a2_framing').catch(() => FRAMING_FALLBACK);
  return ok({
    story_premise: picked.data.plan.story_premise,
    scenes: picked.data.plan.scenes.map((scene) => ({ ...scene, image_url: scene.image_url ?? '' })),
    framing_text: framingText,
    bank_group_id: picked.data.groupId,
  });
}

export interface PictureStoryEvaluation {
  sessionId: string;
  feedback: PictureStoryFeedback;
}

/** Evaluates the story first; the session is created and closed only when the evaluation succeeds. */
export async function evaluateKETPictureStoryAction(input: {
  sessionId?: string;
  userText: string;
  story_premise: string;
  framing_text: string;
  scenes: StoryScene[];
  image_urls: string[];
  bank_group_id?: string;
}): Promise<PictureStoryEvaluation | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

  const evaluationPromptTemplate = await getPrompt('cambridge_ket_writing_part7_a2_evaluation').catch(() => null);
  if (!evaluationPromptTemplate) return { error: 'evaluation_unavailable' };

  const sceneSummary = input.scenes.map((s) => `Scene ${s.number}: ${s.description}`).join(' | ');
  const prompt = evaluationPromptTemplate
    .replace('{STORY_PREMISE}', input.story_premise)
    .replace('{SCENES}', sceneSummary)
    .replace('{USER_TEXT}', input.userText);

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_writing_part7_a2_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!isOk(geminiResult)) return { error: 'evaluation_failed' };

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(EvaluationSchema, rawText);
  if (!parsed) return { error: 'evaluation_failed' };

  const feedback: PictureStoryFeedback = {
    understood: parsed.understood,
    highlights: parsed.highlights,
    suggestions: parsed.suggestions,
    model_answer: parsed.model_answer ?? null,
    rubric: parsed.rubric,
  };

  const completed = await completeActivity({
    mode: 'cambridge_ket_writing_part7',
    sessionId: input.sessionId,
    bank: bankStamp(KET_PICTURE_STORY_PART, input.bank_group_id),
    plan: {
      kind: 'picture_story_prompt',
      framing_text: input.framing_text,
      story_premise: input.story_premise,
      scenes: input.scenes,
      image_urls: input.image_urls,
    },
    answers: [],
    answerTexts: [{ contentText: input.userText, contentJson: null }],
    evaluation: { kind: 'picture_story_feedback', ...feedback, rubric: parsed.rubric ?? null },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, feedback };
}
