'use server';

import { z } from 'zod';
import { Type } from '@google/genai';
import { getAiClient } from '../_shared';
import { MODELS } from '@/lib/models';
import { ToeflEvaluationSchema } from '@/lib/types/practice';
import type { ToeflEvaluation } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';

const ToeflQuestionSchema = z.object({
  text: z.string(),
  difficulty: z.number().min(1).max(4),
  suggested_time: z.number(),
});

const ToeflInterviewPlanSchema = z.object({
  topic_id: z.string(),
  topic_name: z.string(),
  topic_context: z.string(),
  questions: z.array(ToeflQuestionSchema).length(4),
});

export type ToeflInterviewPlan = z.infer<typeof ToeflInterviewPlanSchema>;
export type ToeflQuestion = z.infer<typeof ToeflQuestionSchema>;

/**
 * Generates a TOEFL Interview session plan with 4 progressive questions.
 */
export async function generateToeflInterviewAction(): Promise<ToeflInterviewPlan> {
  const ai = getAiClient();
  // Default to B2 level for interview generation
  const prompt = await getPrompt('toefl_interview_b2_generation');

  const response = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic_id: { type: Type.STRING },
          topic_name: { type: Type.STRING },
          topic_context: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                difficulty: { type: Type.NUMBER },
                suggested_time: { type: Type.NUMBER },
              },
              required: ['text', 'difficulty', 'suggested_time'],
            },
          },
        },
        required: ['topic_id', 'topic_name', 'topic_context', 'questions'],
      },
    },
  });

  const raw = response.text ?? '';
  const parsed = ToeflInterviewPlanSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Invalid TOEFL interview plan: ${parsed.error.message}`);
  }

  return parsed.data;
}

/**
 * Evaluates a user's spoken response to a TOEFL interview question.
 */
export async function evaluateToeflResponseAction(
  question: string,
  audioBase64: string,
  mimeType: string
): Promise<ToeflEvaluation> {
  const ai = getAiClient();
  // Default to B2 level for interview evaluation
  const prompt = await getPrompt('toefl_interview_b2_evaluation', { QUESTION: question, TOPIC: '', USER_TRANSCRIPT: '', AUDIO_DURATION_SECONDS: 0 });

  const response = await ai.models.generateContent({
    model: MODELS.FLASH_LITE_PREVIEW,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          fluency: { type: Type.NUMBER },
          vocabulary: { type: Type.NUMBER },
          grammar: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
          transcribed_text: { type: Type.STRING },
        },
        required: ['score', 'fluency', 'vocabulary', 'grammar', 'feedback', 'transcribed_text'],
      },
    },
  });

  const raw = response.text ?? '';
  const parsed = ToeflEvaluationSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Invalid TOEFL response evaluation: ${parsed.error.message}`);
  }

  return parsed.data;
}
