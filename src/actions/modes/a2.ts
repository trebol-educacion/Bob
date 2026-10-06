'use server';

import { A2_SESSION_PLAN_FALLBACK, A2SessionPlanSchema, type A2SessionPlan } from '@/lib/speaking/ket-content';
import { pickPlan } from '@/lib/item-bank/plan-bank';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import {
  evaluateQuestionRound,
  processQuestionRoundAnswer,
  type QuestionRoundConfig,
} from '@/lib/speaking/question-round';
import type {
  QuestionRoundAnswer,
  QuestionRoundContext,
  QuestionRoundEvaluation,
  SpeakingQA,
} from '@/lib/speaking/types';

const KET_P1_PART = 'ket_part1';

const KET_P1_CONFIG: QuestionRoundConfig<A2SessionPlan> = {
  mode: 'cambridge_ket_part1',
  promptPrefix: 'cambridge_ket_part1_a2',
  transcribePromptKey: 'cambridge_ket_part1_a2_transcribe',
  reactionPromptKey: 'cambridge_ket_a2_rubric_helper',
  planCacheKey: 'cambridge-ket-part1-a2-plan',
  planSchema: A2SessionPlanSchema,
  planFallback: A2_SESSION_PLAN_FALLBACK,
  logTag: 'KET-p1',
  eventName: 'A2Session',
  scoredEvaluation: true,
};

export async function generateA2SessionAction(): Promise<ActionResult<A2SessionPlan>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const picked = await pickPlan({
    exam: 'ket',
    cefr: 'a2',
    examPart: KET_P1_PART,
    skill: 'speaking',
    schema: A2SessionPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;
  return ok({ ...picked.data.plan, exam_part: KET_P1_PART, bank_group_id: picked.data.groupId });
}

export async function processA2AnswerAction(
  audioBase64: string,
  mimeType: string,
  question: string,
  context: QuestionRoundContext<A2SessionPlan>,
): Promise<ActionResult<QuestionRoundAnswer>> {
  return processQuestionRoundAnswer(KET_P1_CONFIG, audioBase64, mimeType, question, context);
}

export async function evaluateA2FinalAction(
  questionsAndAnswers: SpeakingQA[],
  context: QuestionRoundContext<A2SessionPlan>,
): Promise<ActionResult<QuestionRoundEvaluation>> {
  return evaluateQuestionRound(KET_P1_CONFIG, questionsAndAnswers, context);
}
