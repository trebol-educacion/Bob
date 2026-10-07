'use server';

import { MODELS } from '@/lib/models';
import { FormativeFeedbackSchema, type FormativeFeedback } from '@/lib/types/practice';
import { pickPlan, bankStamp } from '@/lib/item-bank/plan-bank';
import { ToeflInterviewBankSchema } from '@/lib/bank-plans/toefl-interview';
import { toInterviewPlan } from '@/lib/toefl/interview-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { readSessionMessages } from '@/lib/persist-activity';
import { currentUserId, finishSession, openSession, recordTurn } from '@/lib/session/lifecycle';
import { buildInterviewEvaluation, restoreInterview, INTERVIEW_ANSWER_KIND, type ToeflInterviewPlan } from '@/lib/toefl/interview';
import { callGemini } from '@/lib/gemini-client';

const INTERVIEW_LEVEL = 'b2';
const INTERVIEW_PART = 'toefl_interview';

/** Reads one pregenerated interview set with its audio URLs from the bank; no model call and no session row. */
export async function generateToeflInterviewAction(): Promise<ActionResult<ToeflInterviewPlan>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const picked = await pickPlan({
    exam: 'toefl',
    cefr: INTERVIEW_LEVEL,
    examPart: INTERVIEW_PART,
    skill: 'speaking',
    schema: ToeflInterviewBankSchema,
    userId,
  });
  if (!picked.ok) return picked;
  return ok(toInterviewPlan(picked.data.plan, picked.data.groupId));
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
    opening: [{ role: 'bob', msgType: 'phrase', contentJson: { ...input.plan, ...bankStamp(INTERVIEW_PART, input.plan.bank_group_id) } }],
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
