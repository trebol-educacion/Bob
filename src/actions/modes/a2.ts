'use server';

import { z } from 'zod';
import { getAiClient } from '../_shared';
import { MODELS } from '@/lib/models';
import { CambridgeEvaluationSchema, type CambridgeEvaluation } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';

const A2SessionPlanSchema = z.object({
  phase1_questions: z.array(z.string()).length(3),
  topic1: z.string(),
  topic1_questions: z.array(z.string()).length(4),
  topic2: z.string(),
  topic2_questions: z.array(z.string()).length(3),
  final_question: z.string(),
});

export type A2SessionPlan = z.infer<typeof A2SessionPlanSchema>;

export async function generateA2SessionAction(): Promise<A2SessionPlan> {
  const ai = getAiClient();

  const response = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [{ role: 'user', parts: [{ text: await getPrompt('cambridge_ket_part1_a2_generation') }] }],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const raw = response.text ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Gemini returned invalid JSON');
  }
  const result = A2SessionPlanSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid A2 session plan from AI: ${result.error.message}`);
  }

  return result.data;
}

export async function processA2AnswerAction(
  audioBase64: string,
  mimeType: string,
  question: string
): Promise<{ transcribed: string; reaction: string }> {
  const ai = getAiClient();

  const transcribeResponse = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: await getPrompt('cambridge_ket_part1_a2_transcribe'),
          },
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
        ],
      },
    ],
  });

  const transcribed = (transcribeResponse.text ?? '').trim();

  const reactionResponse = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [
      {
        role: 'user',
        parts: [{ text: await getPrompt('cambridge_ket_a2_rubric_helper', { QUESTION: question }) }],
      },
    ],
  });

  const reaction = (reactionResponse.text ?? '').trim();

  return { transcribed, reaction };
}

export async function evaluateA2FinalAction(
  questionsAndAnswers: Array<{ question: string; answer: string }>
): Promise<CambridgeEvaluation> {
  const ai = getAiClient();

  const transcript = questionsAndAnswers
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`)
    .join('\n\n');
  const prompt = await getPrompt('cambridge_ket_part1_a2_evaluation', { QUESTION: 'Full interview', USER_TRANSCRIPT: transcript, AUDIO_DURATION_SECONDS: 0 });

  const response = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const raw = response.text ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Gemini returned invalid JSON');
  }
  const result = CambridgeEvaluationSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid A2 evaluation from AI: ${result.error.message}`);
  }

  return result.data;
}
