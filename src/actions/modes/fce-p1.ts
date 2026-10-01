'use server';

import type { FormativeFeedback } from '@/lib/types/practice';
import { FCE_INTERVIEW_CONFIG } from '@/lib/speaking/fce-configs';
import type { FCEInterviewPlan } from '@/lib/speaking/fce-content';
import {
  evaluateQuestionRound,
  generateQuestionRoundPlan,
  processQuestionRoundAnswer,
  readQuestionRoundMessages,
} from '@/lib/speaking/question-round';
import type { SpeakingQA } from '@/lib/speaking/types';

export async function generateFCEInterviewAction(sessionId: string, userId: string): Promise<FCEInterviewPlan> {
  return generateQuestionRoundPlan(FCE_INTERVIEW_CONFIG, sessionId, userId);
}

export async function processFCEInterviewAnswerAction(
  audioBase64: string,
  mimeType: string,
  question: string,
  sessionId: string,
  userId: string,
): Promise<{ transcribed: string; reaction: string }> {
  return processQuestionRoundAnswer(FCE_INTERVIEW_CONFIG, audioBase64, mimeType, question, sessionId, userId);
}

export async function evaluateFCEInterviewAction(
  questionsAndAnswers: SpeakingQA[],
  sessionId: string,
  userId: string,
): Promise<FormativeFeedback> {
  return evaluateQuestionRound(FCE_INTERVIEW_CONFIG, questionsAndAnswers, sessionId, userId);
}

export async function getFCEInterviewMessagesAction(sessionId: string): Promise<{
  plan: FCEInterviewPlan | null;
  qas: SpeakingQA[];
  feedback: FormativeFeedback | null;
}> {
  return readQuestionRoundMessages(FCE_INTERVIEW_CONFIG, sessionId);
}
