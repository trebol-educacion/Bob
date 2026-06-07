'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
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

export interface PictureStoryPrompt {
  sessionId: string;
  userId: string;
  story_premise: string;
  scenes: StorySceneWithImage[];
  framing_text: string;
}

/** Plan without images — returned by the fast first-phase action. */
export interface PictureStoryPlan {
  sessionId: string;
  userId: string;
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

function buildFallbackFeedback(): PictureStoryFeedback {
  return { understood: false, highlights: [], suggestions: ['Please write your story and try again.'], model_answer: null };
}

/**
 * Phase 1 — fast (~2s): generates the story premise + scene descriptions only.
 * The component renders the exercise immediately, then loads the 3 scene
 * images in the background via generateKETSceneImageAction.
 */
export async function generateKETPictureStoryPlanAction(input: {
  sessionId?: string;
}): Promise<PictureStoryPlan | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({ mode: 'cambridge_ket_writing_part7', title: 'Writing Part 7 — Picture Story' });
    if (!result.data) return { error: result.error ?? 'Could not create session' };
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    userId = user.id;
  }

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

  persistMessage({
    sessionId: sessionId!, userId: userId!, role: 'bob', msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'picture_story_prompt',
      framing_text: framingText,
      story_premise: parsed.story_premise,
      scenes: parsed.scenes,
      image_urls: ['', '', ''],
    },
  }).catch(() => undefined);

  return {
    sessionId: sessionId!, userId: userId!,
    story_premise: parsed.story_premise,
    scenes: parsed.scenes,
    framing_text: framingText,
  };
}

/** Phase 2 — generates a single scene image (~6-9s, cached). */
export async function generateKETSceneImageAction(input: {
  imagePrompt: string;
  sessionId: string;
}): Promise<{ image_url: string }> {
  const urls = await generateYLImagesParallelAction('movers', 7, [input.imagePrompt], input.sessionId, undefined, 'scene').catch(
    () => ['']
  );
  return { image_url: urls[0] ?? '' };
}

/** Legacy full action (kept for compatibility — restore path uses persisted images). */
export async function generateKETPictureStoryAction(input: {
  sessionId?: string;
}): Promise<PictureStoryPrompt | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({ mode: 'cambridge_ket_writing_part7', title: 'Writing Part 7 — Picture Story' });
    if (!result.data) return { error: result.error ?? 'Could not create session' };
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    userId = user.id;
  }

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

  const imagePrompts = parsed.scenes.map((s) => s.image_prompt);
  const imageUrls = await generateYLImagesParallelAction('movers', 7, imagePrompts, sessionId!, undefined, 'scene').catch(
    () => imagePrompts.map(() => '')
  );

  const scenesWithImages: StorySceneWithImage[] = parsed.scenes.map((s, i) => ({
    ...s,
    image_url: imageUrls[i] ?? '',
  }));

  persistMessage({
    sessionId: sessionId!, userId: userId!, role: 'bob', msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'picture_story_prompt',
      framing_text: framingText,
      story_premise: parsed.story_premise,
      scenes: parsed.scenes,
      image_urls: imageUrls,
    },
  }).catch(() => undefined);

  return {
    sessionId: sessionId!, userId: userId!,
    story_premise: parsed.story_premise,
    scenes: scenesWithImages,
    framing_text: framingText,
  };
}

export async function evaluateKETPictureStoryAction(input: {
  sessionId: string;
  userId: string;
  userText: string;
  story_premise: string;
  scenes: StoryScene[];
}): Promise<PictureStoryFeedback | { error: string }> {
  const evaluationPromptTemplate = await getPrompt('cambridge_ket_writing_part7_a2_evaluation').catch(() => null);
  if (!evaluationPromptTemplate) return buildFallbackFeedback();

  const sceneSummary = input.scenes.map((s) => `Scene ${s.number}: ${s.description}`).join(' | ');
  const prompt = evaluationPromptTemplate
    .replace('{STORY_PREMISE}', input.story_premise)
    .replace('{SCENES}', sceneSummary)
    .replace('{USER_TEXT}', input.userText);

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_ket_writing_part7_a2_evaluation', model: MODELS.FLASH_LITE_PREVIEW, userId: input.userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!isOk(geminiResult)) return buildFallbackFeedback();

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(EvaluationSchema, rawText);
  if (!parsed) return buildFallbackFeedback();

  const feedback: PictureStoryFeedback = {
    understood: parsed.understood,
    highlights: parsed.highlights,
    suggestions: parsed.suggestions,
    model_answer: parsed.model_answer ?? null,
    rubric: parsed.rubric,
  };

  persistMessage({
    sessionId: input.sessionId, userId: input.userId, role: 'user', msgType: 'text',
    contentText: input.userText, contentJson: null,
  }).catch(() => undefined);

  persistMessage({
    sessionId: input.sessionId, userId: input.userId, role: 'bob', msgType: 'evaluation',
    contentText: null,
    contentJson: { kind: 'picture_story_feedback', ...feedback, rubric: parsed.rubric ?? null, is_final: true },
  }).catch(() => undefined);

  return feedback;
}
