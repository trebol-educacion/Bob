'use server';

import { Type } from '@google/genai';
import { MODELS } from '@/lib/models';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini } from '@/lib/gemini-client';
import { parseSuggestedAnswer } from '@/lib/practice/model-answer';
import type { ChatMessage } from './types';
import type { CefrLevel } from '@/lib/types/practice';

const SUGGEST_ANSWER_PROMPT_KEY = 'practice_free_shared_suggest_answer';
const FALLBACK_ANSWER = "I'm not sure what to say, but I'll try my best.";

export interface SuggestStudentAnswerResult {
  ok: true;
  answer: string;
}

/**
 * @param history ChatMessage[]
 * @param topic string
 * @param level CefrLevel
 * @returns SuggestStudentAnswerResult
 */
export async function suggestStudentAnswerAction(
  history: ChatMessage[],
  topic: string,
  level: CefrLevel = 'b1'
): Promise<SuggestStudentAnswerResult> {
  const prompt = await getPrompt(SUGGEST_ANSWER_PROMPT_KEY, { TOPIC: topic, CEFR_LEVEL: level });

  const result = await callGemini(
    { promptKey: SUGGEST_ANSWER_PROMPT_KEY, model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        ...history.map((msg) => ({ role: msg.role, parts: [{ text: msg.text }] })),
        { role: 'user', parts: [{ text: prompt }] },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
          },
          required: ['answer'],
        },
      },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'suggestStudentAnswerAction', error: result.ok ? 'empty response' : result.error }));
    return { ok: true, answer: FALLBACK_ANSWER };
  }

  const answer = parseSuggestedAnswer(result.data.text);
  return { ok: true, answer: answer || FALLBACK_ANSWER };
}
