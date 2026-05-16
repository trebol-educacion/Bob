'use server';

import { z } from 'zod';
import { Type } from '@google/genai';
import { getAiClient } from '../_shared';
import { MODELS } from '@/lib/models';
import { ToeflEvaluationSchema } from '@/lib/types/practice';
import type { ToeflEvaluation } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { persistMessage, readSessionMessages } from '@/lib/persist-activity';

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

/** Persists the generated question plan as a single phrase row in bob_messages. */
export async function persistToeflPlanAction(
  sessionId: string,
  userId: string,
  plan: ToeflInterviewPlan
): Promise<void> {
  const result = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'phrase',
    contentJson: { questions: plan.questions, topic_id: plan.topic_id, topic_name: plan.topic_name, topic_context: plan.topic_context },
  });
  if ('error' in result) {
    console.error('[ToeflInterview persist] plan:', result.error);
  }
}

/** Persists a single user spoken response with its transcription. */
export async function persistToeflResponseAction(
  sessionId: string,
  userId: string,
  questionIndex: number,
  transcribedText: string,
  durationMs: number
): Promise<void> {
  const result = await persistMessage({
    sessionId,
    userId,
    role: 'user',
    msgType: 'user_audio',
    contentText: transcribedText,
    contentJson: { questionIndex, durationMs },
  });
  if ('error' in result) {
    console.error('[ToeflInterview persist] user response:', result.error);
  }
}

/** Persists the formative evaluation for a single question as an evaluation row. */
export async function persistToeflQuestionEvaluationAction(
  sessionId: string,
  userId: string,
  questionIndex: number,
  evaluation: ToeflEvaluation
): Promise<void> {
  const { feedback, fluency, vocabulary, grammar, transcribed_text } = evaluation;
  const result = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'evaluation',
    contentText: feedback,
    contentJson: { questionIndex, fluency, vocabulary, grammar, transcribed_text },
  });
  if ('error' in result) {
    console.error('[ToeflInterview persist] evaluation:', result.error);
  }
}

/** Persists the aggregated session-end summary evaluation. */
export async function persistToeflSessionSummaryAction(
  sessionId: string,
  userId: string,
  evaluations: ToeflEvaluation[]
): Promise<void> {
  const count = evaluations.length;
  if (count === 0) return;
  const avg = (key: keyof Pick<ToeflEvaluation, 'fluency' | 'vocabulary' | 'grammar'>) =>
    evaluations.reduce((s, e) => s + e[key], 0) / count;
  const result = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: {
      summary: true,
      questionsAnswered: count,
      avgFluency: avg('fluency'),
      avgVocabulary: avg('vocabulary'),
      avgGrammar: avg('grammar'),
      feedbacks: evaluations.map((e) => e.feedback),
    },
  });
  if ('error' in result) {
    console.error('[ToeflInterview persist] session summary:', result.error);
  }
}

/** Returns all persisted messages for a TOEFL interview session for hydration. */
export async function getToeflInterviewSessionMessagesAction(
  sessionId: string,
  userId: string
) {
  return readSessionMessages(sessionId, userId);
}
