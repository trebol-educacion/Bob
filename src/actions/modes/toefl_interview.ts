'use server';

import { z } from 'zod';
import { Type } from '@google/genai';
import { MODELS } from '@/lib/models';
import { FormativeFeedbackSchema, type FormativeFeedback } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { persistMessage, readSessionMessages } from '@/lib/persist-activity';
import { getOrCreateCachedContent } from '@/lib/cache';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';

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

const PlanFallback: ToeflInterviewPlan = {
  topic_id: 'daily_life',
  topic_name: 'Daily Life',
  topic_context: 'Talk about your everyday routines and activities.',
  questions: [
    { text: 'Can you describe a typical day in your life?', difficulty: 1, suggested_time: 45 },
    { text: 'What do you usually do in your free time?', difficulty: 2, suggested_time: 45 },
    { text: 'How has technology changed the way you spend your time?', difficulty: 3, suggested_time: 60 },
    { text: 'What would your ideal daily routine look like and why?', difficulty: 4, suggested_time: 60 },
  ],
};

const FormativeFeedbackFallback: FormativeFeedback = {
  kind: 'formative',
  understood: false,
  highlights: [],
  suggestions: ['Try again — we could not process your response.'],
};

/** Generates a TOEFL Interview session plan with 4 progressive questions. */
export async function generateToeflInterviewAction(): Promise<ToeflInterviewPlan> {
  const cached = await getOrCreateCachedContent<ToeflInterviewPlan>(
    { kind: 'plan', promptKey: 'toefl-interview-b2-plan', inputs: {} },
    async () => {
      const prompt = await getPrompt('toefl_interview_b2_generation');

      const result = await callGemini(
        { promptKey: 'toefl_interview_b2_generation', model: MODELS.FLASH_LITE_PREVIEW },
        (ai) => ai.models.generateContent({
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
        })
      );

      if (!result.ok || !result.data.text) {
        console.error(JSON.stringify({ event: 'generateToeflInterviewAction', error: result.ok ? 'empty response' : result.error }));
        return PlanFallback;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.data.text);
      } catch {
        return PlanFallback;
      }
      return safeParseFallback(ToeflInterviewPlanSchema, parsed, PlanFallback);
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generateToeflInterviewAction_cache', error: cached.error }));
    return PlanFallback;
  }
  return cached;
}

/** Evaluates a user's spoken TOEFL response and returns formative feedback (no numeric score). */
export async function evaluateToeflResponseAction(
  question: string,
  audioBase64: string,
  mimeType: string
): Promise<FormativeFeedback> {
  const prompt = `You are a supportive TOEFL iBT speaking coach giving formative feedback to an English learner.

The student answered this question:
"${question}"

Listen to the audio and return ONLY a JSON object with these fields:
- "kind": always "formative"
- "understood": boolean — did the student communicate their main idea clearly?
- "highlights": array of 1-3 strings celebrating specific strengths (e.g. "Good use of examples", "Clear main idea stated at the start")
- "suggestions": array of 1-3 specific improvement tips (e.g. "Try to elaborate more on your second point", "Use discourse markers like 'firstly' and 'however'")
- "model_answer": one example sentence or phrase showing a strong way to open or conclude this answer

Return ONLY valid JSON. No score, no band, no percentage.`;

  const result = await callGemini(
    { promptKey: 'toefl_interview_b2_formative', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            { text: prompt },
          ],
        },
      ],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluateToeflResponseAction', error: result.ok ? 'empty response' : result.error }));
    return FormativeFeedbackFallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return FormativeFeedbackFallback;
  }
  return safeParseFallback(FormativeFeedbackSchema, parsed, FormativeFeedbackFallback);
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

/** Persists the formative feedback for a single question as an evaluation row. */
export async function persistToeflQuestionEvaluationAction(
  sessionId: string,
  userId: string,
  questionIndex: number,
  feedback: FormativeFeedback
): Promise<void> {
  const result = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'evaluation',
    contentText: feedback.suggestions[0] ?? '',
    contentJson: { questionIndex, ...feedback },
  });
  if ('error' in result) {
    console.error('[ToeflInterview persist] evaluation:', result.error);
  }
}

/** Persists the aggregated session-end summary. */
export async function persistToeflSessionSummaryAction(
  sessionId: string,
  userId: string,
  feedbacks: FormativeFeedback[]
): Promise<void> {
  const count = feedbacks.length;
  if (count === 0) return;
  const result = await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: {
      summary: true,
      questionsAnswered: count,
      highlights: feedbacks.flatMap((f) => f.highlights),
      suggestions: feedbacks.flatMap((f) => f.suggestions),
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
