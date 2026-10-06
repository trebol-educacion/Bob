'use server';

import type { ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { FCE_INTERVIEW_CONFIG } from '@/lib/speaking/fce-configs';
import type { FCEInterviewPlan } from '@/lib/speaking/fce-content';
import {
  evaluateQuestionRound,
  generateQuestionRoundPlan,
  processQuestionRoundAnswer,
} from '@/lib/speaking/question-round';
import type {
  QuestionRoundAnswer,
  QuestionRoundContext,
  QuestionRoundEvaluation,
  SpeakingQA,
} from '@/lib/speaking/types';

export async function generateFCEInterviewAction(): Promise<FCEInterviewPlan> {
  const userId = await currentUserId();
  if (!userId) return FCE_INTERVIEW_CONFIG.planFallback;
  return generateQuestionRoundPlan(FCE_INTERVIEW_CONFIG, userId);
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
