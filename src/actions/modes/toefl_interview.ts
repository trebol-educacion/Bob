'use server';

import { Type } from '@google/genai';
import { MODELS } from '@/lib/models';
import { FormativeFeedbackSchema, type FormativeFeedback } from '@/lib/types/practice';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { readSessionMessages } from '@/lib/persist-activity';
import { currentUserId, finishSession, openSession, recordTurn } from '@/lib/session/lifecycle';
import { ToeflInterviewPlanSchema, buildInterviewEvaluation, restoreInterview, INTERVIEW_ANSWER_KIND, type ToeflInterviewPlan } from '@/lib/toefl/interview';
import { getOrCreateCachedContent } from '@/lib/cache';
import { parseJsonResult } from '@/lib/llm/parse-json-result';
import { callGemini } from '@/lib/gemini-client';

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

      return parseJsonResult<ToeflInterviewPlan>(result, ToeflInterviewPlanSchema, 'generateToeflInterviewAction');
    },
    { storeAs: 'json', validate: (plan) => ToeflInterviewPlanSchema.safeParse(plan).success }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generateToeflInterviewAction_cache', error: cached.error }));
    return PlanFallback;
  }
  return cached;
}

const MODE = 'toefl_interview';

export interface ToeflAnswerInput {
  plan: ToeflInterviewPlan;
  questionIndex: number;
  audioBase64: string;
  mimeType: string;
  durationMs: number;
  sessionId?: string;
}

export interface ToeflAnswerOutcome {
  sessionId: string;
  feedback: FormativeFeedback;
}

async function evaluateSpokenAnswer(question: string, audioBase64: string, mimeType: string): Promise<FormativeFeedback | null> {
  const prompt = `You are a supportive TOEFL iBT speaking coach giving formative feedback to an English learner.

The student answered this question:
"${question}"

Listen to the audio and return ONLY a JSON object with these fields:
- "kind": always "formative"
- "understood": boolean, did the student communicate their main idea clearly?
- "highlights": array of 1-3 strings celebrating specific strengths (e.g. "Good use of examples", "Clear main idea stated at the start")
- "suggestions": array of 1-3 specific improvement tips (e.g. "Try to elaborate more on your second point", "Use discourse markers like 'firstly' and 'however'")
- "model_answer": one example sentence or phrase showing a strong way to open or conclude this answer
- "rubric": an object with four integer scores 0-4 each: { "task_coverage": 0-4, "grammar": 0-4, "vocabulary": 0-4, "fluency": 0-4 }

Return ONLY valid JSON. No score, no band, no percentage outside the rubric object.`;

  const userId = (await currentUserId()) ?? undefined;
  const result = await callGemini(
    { promptKey: 'toefl_interview_b2_formative', model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: audioBase64 } }, { text: prompt }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
  );
  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluateSpokenAnswer', error: result.ok ? 'empty response' : result.error }));
    return null;
  }
  try {
    const parsed = FormativeFeedbackSchema.safeParse(JSON.parse(result.data.text));
    return parsed.success && parsed.data.rubric ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Evaluates a spoken answer by rubric; opens the session on the first graded answer and persists the turn. */
export async function submitToeflAnswerAction(input: ToeflAnswerInput): Promise<ToeflAnswerOutcome | { error: string }> {
  const question = input.plan.questions[input.questionIndex];
  if (!question) return { error: 'invalid_question' };
  const feedback = await evaluateSpokenAnswer(question.text, input.audioBase64, input.mimeType);
  if (!feedback) return { error: 'evaluation_failed' };

  const opened = await openSession({
    mode: MODE,
    sessionId: input.sessionId,
    topic: input.plan.topic_id,
    opening: [{ role: 'bob', msgType: 'phrase', contentJson: { ...input.plan } }],
  });
  if (!opened.ok) return { error: opened.code };

  const turn = await recordTurn({
    ...opened.data,
    messages: [
      {
        role: 'user',
        msgType: 'text',
        contentText: null,
        contentJson: { kind: INTERVIEW_ANSWER_KIND, questionIndex: input.questionIndex, question: question.text, durationMs: input.durationMs },
      },
      {
        role: 'bob',
        msgType: 'evaluation',
        contentText: feedback.suggestions[0] ?? '',
        contentJson: { questionIndex: input.questionIndex, ...feedback },
      },
    ],
  });
  if (!turn.ok) return { error: turn.code };
  return { sessionId: opened.data.sessionId, feedback };
}

/** Closes the interview with the 0-10 grade averaged from the rubrics of the persisted answers. */
export async function finishToeflInterviewAction(sessionId: string): Promise<{ score10: number | null } | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };
  const restored = restoreInterview(await readSessionMessages(sessionId, userId));
  const evaluation = restored ? buildInterviewEvaluation(restored.evaluations) : null;
  if (!evaluation) return { error: 'nothing_to_grade' };
  const finished = await finishSession({ sessionId, userId, evaluation });
  return finished.ok ? { score10: finished.data.score10 } : { error: finished.code };
}
