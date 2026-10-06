'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { currentUserId } from '@/lib/session/lifecycle';
import { MODELS } from '@/lib/models';
import { generateYLImagesParallelAction } from '@/actions/modes/yl';
import { GenerationSchema, type PETPictureDescriptionResult } from './contracts';
import { pickRandomTopic, safeParse } from './shared';

export async function generatePETPictureDescriptionAction(): Promise<PETPictureDescriptionResult | { error: string }> {
  const tStart = Date.now();
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };

  const topic = pickRandomTopic();
  console.log(JSON.stringify({
    event: 'pet_p2_topic_picked',
    userId,
    topic,
  }));

  const [generationPromptText, framingText] = await Promise.all([
    getPrompt('cambridge_pet_p2_b1_generation', { TOPIC: topic }).catch(() => null),
    getPrompt('cambridge_pet_p2_b1_framing').catch(() => ''),
  ]);

  if (!generationPromptText) {
    return { error: 'Could not load generation prompt' };
  }

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_pet_p2_b1_generation', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: generationPromptText }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(geminiResult)) {
    return { error: 'Could not generate scene' };
  }

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);

  if (!parsed) {
    return { error: 'Unexpected model response for generation' };
  }

  const tImgStart = Date.now();
  console.log(JSON.stringify({
    event: 'pet_p2_image_request',
    scenePromptPreview: parsed.scene_prompt.slice(0, 120),
  }));
  const imageUrls = await generateYLImagesParallelAction(
    'starters',
    1,
    [parsed.scene_prompt],
    crypto.randomUUID(),
    undefined,
    'photo_realistic'
  );
  const imageUrl = imageUrls[0] ?? '';
  console.log(JSON.stringify({
    event: 'pet_p2_image_done',
    latencyMs: Date.now() - tImgStart,
    imageReady: !!imageUrl,
    isHttpUrl: imageUrl.startsWith('https://'),
    isDataUri: imageUrl.startsWith('data:'),
  }));

  console.log(JSON.stringify({
    event: 'pet_p2_generate_done',
    userId,
    topic: parsed.topic,
    totalLatencyMs: Date.now() - tStart,
  }));

  return {
    topic: parsed.topic,
    framingText,
    scenePrompt: parsed.scene_prompt,
    referenceVocabulary: parsed.reference_vocabulary,
    languageBank: parsed.language_bank,
    imageUrl,
  };
}

