'use server';

import { pickContent } from '@/lib/item-bank/content-source';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { toInterviewPlan } from '@/lib/speaking/fce-bank';
import { FCE_INTERVIEW_CONFIG } from '@/lib/speaking/fce-configs';
import { FCE_INTERVIEW_PART, type FCEInterviewPlan } from '@/lib/speaking/fce-content';
import {
  evaluateQuestionRound,
  processQuestionRoundAnswer,
} from '@/lib/speaking/question-round';
import type {
  QuestionRoundAnswer,
  QuestionRoundContext,
  QuestionRoundEvaluation,
  SpeakingQA,
} from '@/lib/speaking/types';

export async function generateFCEInterviewAction(): Promise<ActionResult<FCEInterviewPlan>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const picked = await pickContent({
    framework: 'fce',
    cefr: 'b2',
    examPart: FCE_INTERVIEW_PART,
    purpose: 'practice',
    groupsOnly: true,
    itemless: true,
    skill: 'speaking',
    userId,
  });
  if (!picked.ok) return picked;
  const plan = toInterviewPlan(picked.data);
  return plan ? ok(plan) : fail('no_content');
}

export async function processFCEInterviewAnswerAction(
  audioBase64: string,
  mimeType: string,
  question: string,
  context: QuestionRoundContext<FCEInterviewPlan>,
): Promise<ActionResult<QuestionRoundAnswer>> {
  return processQuestionRoundAnswer(FCE_INTERVIEW_CONFIG, audioBase64, mimeType, question, context);
}

export async function evaluateFCEInterviewAction(
  questionsAndAnswers: SpeakingQA[],
  context: QuestionRoundContext<FCEInterviewPlan>,
): Promise<ActionResult<QuestionRoundEvaluation>> {
  return evaluateQuestionRound(FCE_INTERVIEW_CONFIG, questionsAndAnswers, context);
}
