'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { randomUUID } from 'node:crypto';
import { currentUserId } from '@/lib/session/lifecycle';
import { MODELS } from '@/lib/models';
import { generateYLImagesParallelAction } from '@/actions/modes/yl';
import { GenerationSchema, type FCELongTurnResult } from './contracts';
import { pickRandomTopic, safeParse } from './shared';

/** Generates a Long Turn task for FCE B2 Part 2; persists nothing until the recording is evaluated. */
export async function generateFCEPictureDescriptionAction(): Promise<FCELongTurnResult | { error: string }> {
  const tStart = Date.now();
  const userId = await currentUserId();
  if (!userId) return { error: 'Not authenticated' };
  const assetFolder = randomUUID();

  const topic = pickRandomTopic();
  console.log(JSON.stringify({
    event: 'fce_p2_topic_picked',
    userId,
    topic,
  }));

  const [generationPromptText, framingText] = await Promise.all([
    getPrompt('cambridge_fce_p2_b2_generation', { TOPIC: topic }).catch(() => null),
    getPrompt('cambridge_fce_p2_b2_framing').catch(() => ''),
  ]);

  if (!generationPromptText) {
    return { error: 'Could not load generation prompt' };
  }

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_fce_p2_b2_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: generationPromptText }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(geminiResult)) {
    return { error: 'Could not generate scenes' };
  }

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);

  if (!parsed) {
    return { error: 'Unexpected model response for generation' };
  }

  const tImgStart = Date.now();
  console.log(JSON.stringify({
    event: 'fce_p2_image_request',
    sceneAPreview: parsed.scene_prompt_a.slice(0, 80),
    sceneBPreview: parsed.scene_prompt_b.slice(0, 80),
  }));

  const imageUrls = await generateYLImagesParallelAction(
    'starters',
    2,
    [parsed.scene_prompt_a, parsed.scene_prompt_b],
    assetFolder,
    undefined,
    'photo_realistic'
  );
  const imageUrlA = imageUrls[0] ?? '';
  const imageUrlB = imageUrls[1] ?? '';

  console.log(JSON.stringify({
    event: 'fce_p2_image_done',
    latencyMs: Date.now() - tImgStart,
    imageAReady: !!imageUrlA,
    imageBReady: !!imageUrlB,
  }));

  console.log(JSON.stringify({
    event: 'fce_p2_generate_done',
    userId,
    topic: parsed.topic,
    totalLatencyMs: Date.now() - tStart,
  }));

  return {
    topic: parsed.topic,
    framingText,
    comparisonQuestion: parsed.comparison_question,
    scenePromptA: parsed.scene_prompt_a,
    scenePromptB: parsed.scene_prompt_b,
    referenceVocabulary: parsed.reference_vocabulary,
    languageBank: parsed.language_bank,
    imageUrlA,
    imageUrlB,
  };
}

