'use server';

import type { FormativeFeedback } from '@/lib/types/practice';
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
  readQuestionRoundMessages,
} from '@/lib/speaking/question-round';
import type { SpeakingQA } from '@/lib/speaking/types';

export async function generateFCEDiscussionAction(sessionId: string, userId: string): Promise<FCEDiscussionPlan> {
  const linkedTopic = await readRecentSessionTopic(userId, FCE_COLLABORATIVE_MODE);
  return generateQuestionRoundPlan(FCE_DISCUSSION_CONFIG, sessionId, userId, {
    TOPIC: linkedTopic ?? FCE_OWN_DISCUSSION_TOPIC,
  });
}

export async function processFCEDiscussionAnswerAction(
  audioBase64: string,
  mimeType: string,
  question: string,
  sessionId: string,
  userId: string,
): Promise<{ transcribed: string; reaction: string }> {
  return processQuestionRoundAnswer(FCE_DISCUSSION_CONFIG, audioBase64, mimeType, question, sessionId, userId);
}

export async function evaluateFCEDiscussionAction(
  questionsAndAnswers: SpeakingQA[],
  sessionId: string,
  userId: string,
): Promise<FormativeFeedback> {
  return evaluateQuestionRound(FCE_DISCUSSION_CONFIG, questionsAndAnswers, sessionId, userId);
}

export async function getFCEDiscussionMessagesAction(sessionId: string): Promise<{
  plan: FCEDiscussionPlan | null;
  qas: SpeakingQA[];
  feedback: FormativeFeedback | null;
}> {
  return readQuestionRoundMessages(FCE_DISCUSSION_CONFIG, sessionId);
}
