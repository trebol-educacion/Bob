'use server';

import { pickContent } from '@/lib/item-bank/content-source';
import { fail, ok, type ActionResult } from '@/lib/result';
import { currentUserId } from '@/lib/session/lifecycle';
import { toDiscussionPlan } from '@/lib/speaking/fce-bank';
import { FCE_DISCUSSION_CONFIG } from '@/lib/speaking/fce-configs';
import {
  FCE_COLLABORATIVE_MODE,
  FCE_DISCUSSION_PART,
  type FCEDiscussionPlan,
} from '@/lib/speaking/fce-content';
import { readRecentSessionTopic } from '@/lib/speaking/linked-topic';
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

export async function generateFCEDiscussionAction(): Promise<ActionResult<FCEDiscussionPlan>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  const linkedTopic = await readRecentSessionTopic(userId, FCE_COLLABORATIVE_MODE);
  const picked = await pickContent({
    framework: 'fce',
    cefr: 'b2',
    examPart: FCE_DISCUSSION_PART,
    purpose: 'practice',
    groupsOnly: true,
    skill: 'speaking',
    userId,
    topic: linkedTopic ?? undefined,
  });
  if (!picked.ok) return picked;
  const plan = toDiscussionPlan(picked.data);
  return plan ? ok(plan) : fail('no_content');
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
