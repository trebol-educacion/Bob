'use server';

import { Type, Part } from '@google/genai';
import { MODELS } from '@/lib/models';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { getOrCreateCachedContent } from '@/lib/cache';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';
import { ImageSceneSchema } from '@/lib/types/gemini';
import type { ImageScene } from './types';

/**
 * Generates an image using Gemini Image model.
 */
export async function generateImageAction(prompt: string): Promise<string> {
  const fullPrompt = await getPrompt('generic_image_b1_image_gen', { SCENE_DESCRIPTION: prompt });

  const result = await callGemini(
    { promptKey: 'generic_image_b1_image_gen', model: MODELS.IMAGE },
    (ai) => ai.models.generateContent({
      model: MODELS.IMAGE,
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      config: { responseModalities: ['IMAGE'] },
    })
  );

  if (!result.ok) {
    console.error(JSON.stringify({ event: 'generateImageAction', error: result.error }));
    return '';
  }

  const candidate = result.data.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((p: Part) => p.inlineData);

  if (!imagePart?.inlineData?.data) {
    console.error(JSON.stringify({ event: 'generateImageAction', error: 'no image data' }));
    return '';
  }

  return `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;
}

/**
 * Generates a scene for Speaking description practice.
 * Supports B1 (default) and B2 First difficulty levels.
 */
export async function generateImageSceneAction(
  topic: string = 'Daily Life',
  difficulty: string = 'intermediate',
  level: 'b1' | 'b2' = 'b1'
): Promise<ImageScene> {
  const fallbackScene: ImageScene = {
    topic,
    description: 'A busy street with people going about their day.',
    image_prompt: 'A busy street scene with people walking.',
  };

  const cached = await getOrCreateCachedContent<ImageScene>(
    { kind: 'scene', promptKey: 'generic-image-scene', inputs: { topic, difficulty, level } },
    async () => {
      const prompt = await getPrompt(
        level === 'b2' ? 'generic_image_b2_generation' : 'generic_image_b1_generation',
        { TOPIC: topic, DIFFICULTY: difficulty }
      );

      const result = await callGemini(
        { promptKey: level === 'b2' ? 'generic_image_b2_generation' : 'generic_image_b1_generation', model: MODELS.FLASH_LITE_LATEST },
        (ai) => ai.models.generateContent({
          model: MODELS.FLASH_LITE_LATEST,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                description: { type: Type.STRING },
                image_prompt: { type: Type.STRING },
              },
              required: ['topic', 'description', 'image_prompt'],
            },
          },
        })
      );

      if (!result.ok || !result.data.text) {
        console.error(JSON.stringify({ event: 'generateImageSceneAction', error: result.ok ? 'empty response' : result.error }));
        return fallbackScene;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.data.text);
      } catch {
        return fallbackScene;
      }
      return safeParseFallback(ImageSceneSchema, parsed, fallbackScene);
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generateImageSceneAction_cache', error: cached.error }));
    return fallbackScene;
  }
  return cached;
}

