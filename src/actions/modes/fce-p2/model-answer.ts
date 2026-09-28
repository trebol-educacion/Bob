'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { MODELS } from '@/lib/models';
import { safeParse } from './shared';

/**
 * Lazily fetches a B2 model answer after feedback is shown.
 * Intentionally decoupled from the evaluate call to avoid blocking the feedback phase.
 */
export async function getFCEPictureDescriptionModelAnswerAction(input: {
  topic: string;
  scenePromptA: string;
  scenePromptB: string;
  comparisonQuestion: string;
}): Promise<{ modelAnswer: string } | { error: string }> {
  const tStart = Date.now();
  console.log(JSON.stringify({
    event: 'fce_p2_model_answer_start',
    topic: input.topic,
  }));

  const promptText = await getPrompt('cambridge_fce_p2_b2_model_answer', {
    TOPIC: input.topic,
    SCENE_A: input.scenePromptA,
    SCENE_B: input.scenePromptB,
    COMPARISON_QUESTION: input.comparisonQuestion,
  }).catch(() => null);

  if (!promptText) {
    console.error(JSON.stringify({
      event: 'fce_p2_model_answer_prompt_failed',
      topic: input.topic,
    }));
    return { error: 'Could not load model answer prompt' };
  }

  const result = await callGemini(
    { promptKey: 'cambridge_fce_p2_b2_model_answer', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(result)) {
    console.error(JSON.stringify({
      event: 'fce_p2_model_answer_failed',
      topic: input.topic,
      latencyMs: Date.now() - tStart,
    }));
    return { error: 'Could not generate model answer' };
  }

  const raw = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(z.object({ model_answer: z.string() }), raw);

  if (!parsed) {
    console.error(JSON.stringify({
      event: 'fce_p2_model_answer_parse_failed',
      topic: input.topic,
      rawPreview: raw.slice(0, 200),
    }));
    return { error: 'Unexpected model answer response' };
  }

  console.log(JSON.stringify({
    event: 'fce_p2_model_answer_done',
    topic: input.topic,
    latencyMs: Date.now() - tStart,
    modelAnswerLength: parsed.model_answer.length,
  }));

  return { modelAnswer: parsed.model_answer };
}

