'use server';

import { Type } from '@google/genai';
import { MODELS } from '@/lib/models';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini } from '@/lib/gemini-client';

export interface TopicGuardResult {
  appropriate: boolean;
  reason?: string;
}

/**
 * Falls back to `appropriate: true` on any infra failure, intentional
 * fail-open so a Gemini/network hiccup never blocks the whole feature.
 * Do NOT convert to throw.
 */
export async function checkTopicIsAppropriateAction(topic: string): Promise<TopicGuardResult> {
  const fallback: TopicGuardResult = { appropriate: true };

  const prompt = await getPrompt('generic_conversation_shared_topic_guard', { TOPIC: topic });

  const result = await callGemini(
    { promptKey: 'generic_conversation_shared_topic_guard', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            appropriate: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
          },
          required: ['appropriate'],
        },
      },
    })
  );

  if (!result.ok || !result.data.text) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return fallback;
  }

  const data = parsed as Partial<TopicGuardResult>;
  if (typeof data.appropriate !== 'boolean') return fallback;
  return { appropriate: data.appropriate, reason: data.reason };
}
