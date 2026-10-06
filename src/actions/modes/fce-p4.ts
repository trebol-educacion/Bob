'use server';

import type { ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { FCE_DISCUSSION_CONFIG } from '@/lib/speaking/fce-configs';
import {
  FCE_COLLABORATIVE_MODE,
  FCE_OWN_DISCUSSION_TOPIC,
  type FCEDiscussionPlan,
} from '@/lib/speaking/fce-content';
import { readRecentSessionTopic } from '@/lib/speaking/linked-topic';
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

export async function generateFCEDiscussionAction(): Promise<FCEDiscussionPlan> {
  const userId = await currentUserId();
  if (!userId) return FCE_DISCUSSION_CONFIG.planFallback;
  const linkedTopic = await readRecentSessionTopic(userId, FCE_COLLABORATIVE_MODE);
  return generateQuestionRoundPlan(FCE_DISCUSSION_CONFIG, userId, {
    TOPIC: linkedTopic ?? FCE_OWN_DISCUSSION_TOPIC,
  });
}

export async function processFCEDiscussionAnswerAction(
  audioBase64: string,
  mimeType: string,
  question: string,
  context: QuestionRoundContext<FCEDiscussionPlan>,
): Promise<ActionResult<QuestionRoundAnswer>> {
  return processQuestionRoundAnswer(FCE_DISCUSSION_CONFIG, audioBase64, mimeType, question, context);
}

export async function evaluateFCEDiscussionAction(
  questionsAndAnswers: SpeakingQA[],
  context: QuestionRoundContext<FCEDiscussionPlan>,
): Promise<ActionResult<QuestionRoundEvaluation>> {
  return evaluateQuestionRound(FCE_DISCUSSION_CONFIG, questionsAndAnswers, context);
}
