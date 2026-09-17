'use server';

import { Type } from '@google/genai';
import { MODELS } from '@/lib/models';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';
import { PronunciationEvaluationSchema, ImageDescriptionEvaluationSchema } from '@/lib/types/gemini';
import type { CefrLevel } from '@/lib/vocabulary';
import type { EvaluationResult } from './types';

export async function evaluateImageDescriptionAction(
  audioBase64: string,
  mimeType: string,
  sceneDescription: string,
  level: 'b1' | 'b2' = 'b1'
): Promise<EvaluationResult> {
  const fallback: EvaluationResult = {
    score: 0,
    feedback: 'Unable to evaluate at this time. Please try again.',
    transcribed_text: '',
  };

  const prompt = await getPrompt(
    level === 'b2' ? 'generic_image_b2_evaluation' : 'generic_image_b1_evaluation',
    { SCENE_DESCRIPTION: sceneDescription, AUDIO_DURATION_SECONDS: 0 }
  );

  const result = await callGemini(
    { promptKey: level === 'b2' ? 'generic_image_b2_evaluation' : 'generic_image_b1_evaluation', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: {
        parts: [
          { inlineData: { data: audioBase64, mimeType: mimeType } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            transcribed_text: { type: Type.STRING },
            details: {
              type: Type.OBJECT,
              properties: {
                content_coverage: { type: Type.STRING },
                duration_feedback: { type: Type.STRING },
                clarity: { type: Type.STRING },
                improvement_tips: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['content_coverage', 'duration_feedback', 'clarity', 'improvement_tips'],
            },
            model_answer: { type: Type.STRING },
          },
          required: ['score', 'feedback', 'transcribed_text', 'details'],
        },
      },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluateImageDescriptionAction', error: result.ok ? 'empty response' : result.error }));
    return fallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return fallback;
  }
  return safeParseFallback(ImageDescriptionEvaluationSchema, parsed, fallback);
}

export async function evaluatePronunciationAction(
  audioBase64: string,
  mimeType: string,
  targetPhrase: string,
  level: CefrLevel = 'a2',
): Promise<EvaluationResult> {
  const fallback: EvaluationResult = {
    score: 0,
    feedback: 'Unable to evaluate at this time. Please try again.',
    transcribed_text: '',
  };

  const promptKey = `generic_situation_${level}_evaluation`;
  const prompt = await getPrompt(promptKey, { TARGET_PHRASE: targetPhrase, AUDIO_DURATION_SECONDS: 0 });

  const result = await callGemini(
    { promptKey, model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: audioBase64 } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            transcribed_text: { type: Type.STRING },
          },
          required: ['score', 'feedback', 'transcribed_text'],
        },
      },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluatePronunciationAction', error: result.ok ? 'empty response' : result.error }));
    return fallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return fallback;
  }
  return safeParseFallback(PronunciationEvaluationSchema, parsed, fallback);
}

