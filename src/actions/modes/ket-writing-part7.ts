'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { currentUserId } from '@/lib/session/lifecycle';
import { completeActivity } from '@/lib/session/complete';
import { generateYLImagesParallelAction } from '@/actions/modes/yl';
import { MODELS } from '@/lib/models';

const SceneSchema = z.object({
  number: z.number().int().min(1).max(3),
  description: z.string(),
  image_prompt: z.string(),
});

const GenerationSchema = z.object({
  story_premise: z.string(),
  scenes: z.array(SceneSchema).length(3),
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

export type StoryScene = z.infer<typeof SceneSchema>;

export interface StorySceneWithImage extends StoryScene {
  image_url: string;
}

/** Plan without images, returned by the fast first-phase action. */
export interface PictureStoryPlan {
  story_premise: string;
  scenes: StoryScene[];
  framing_text: string;
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

/**
 * Phase 1, fast (~2s): generates the story premise + scene descriptions only.
 * The component renders the exercise immediately, then loads the 3 scene
 * images in the background via generateKETSceneImageAction.
 */
export async function generateKETPictureStoryPlanAction(): Promise<PictureStoryPlan | { error: string }> {
  const userId = (await currentUserId()) ?? undefined;
  if (!userId) return { error: 'Not authenticated' };

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_ket_writing_part7_a2_generation').catch(() => null),
    getPrompt('cambridge_ket_writing_part7_a2_framing').catch(
      () => 'Look at the three pictures. They tell a story. Write the story in about 35 words or more.'
    ),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_writing_part7_a2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!isOk(geminiResult)) return { error: 'Could not generate story prompt' };

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);
  if (!parsed) return { error: 'Unexpected model response' };

  return {
    story_premise: parsed.story_premise,
    scenes: parsed.scenes,
    framing_text: framingText,
  };
}

/** Phase 2, generates a single scene image (~6-9s, cached). */
export async function generateKETSceneImageAction(input: {
  imagePrompt: string;
}): Promise<{ image_url: string }> {
  const userId = await currentUserId();
  if (!userId) return { image_url: '' };
  const urls = await generateYLImagesParallelAction('movers', 7, [input.imagePrompt], userId, undefined, 'scene').catch(
    () => ['']
  );
  return { image_url: urls[0] ?? '' };
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
