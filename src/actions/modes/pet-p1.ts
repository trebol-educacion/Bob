'use server';

import { z } from 'zod';
import type { FormativeFeedback } from '@/lib/types/practice';
import {
  evaluateQuestionRound,
  generateQuestionRoundPlan,
  processQuestionRoundAnswer,
  readQuestionRoundMessages,
  type QuestionRoundConfig,
} from '@/lib/speaking/question-round';
import type { SpeakingQA } from '@/lib/speaking/types';

const PETInterviewPlanSchema = z.object({
  phase1_questions: z.array(z.string()).min(1),
  topicA: z.string(),
  topicA_questions: z.array(z.string()).min(1),
  topicA_followup: z.string(),
  topicBC: z.string(),
  topicBC_questions: z.array(z.string()).min(1),
  topicBC_followup: z.string(),
  closing: z.string(),
});

export type PETInterviewPlan = z.infer<typeof PETInterviewPlanSchema>;

const PET_P1_CONFIG: QuestionRoundConfig<PETInterviewPlan> = {
  promptPrefix: 'cambridge_pet_p1_b1',
  transcribePromptKey: 'cambridge_ket_part1_a2_transcribe',
  planCacheKey: 'cambridge-pet-p1-b1-plan',
  planSchema: PETInterviewPlanSchema,
  planFallback: {
    phase1_questions: ["Hello! What's your name?", 'Where are you from?'],
    topicA: 'Studies, Work and Ambitions',
    topicA_questions: ['Do you work or are you a student?', 'What job would you like to do in the future?'],
    topicA_followup: 'Can you tell me more about that?',
    topicBC: 'Daily Life',
    topicBC_questions: ['What do you usually do at weekends?', 'Tell me about a hobby you started recently.'],
    topicBC_followup: 'Why do you enjoy it?',
    closing: 'Thank you. That is the end of Part 1.',
  },
  logTag: 'PET-p1',
  eventName: 'PETInterview',
};

export async function generatePETInterviewAction(sessionId: string, userId: string): Promise<PETInterviewPlan> {
  return generateQuestionRoundPlan(PET_P1_CONFIG, sessionId, userId);
}

export async function processPETInterviewAnswerAction(
  audioBase64: string,
  mimeType: string,
  question: string,
  sessionId: string,
  userId: string,
): Promise<{ transcribed: string; reaction: string }> {
  return processQuestionRoundAnswer(PET_P1_CONFIG, audioBase64, mimeType, question, sessionId, userId);
}

export async function evaluatePETInterviewAction(
  questionsAndAnswers: SpeakingQA[],
  sessionId: string,
  userId: string,
): Promise<FormativeFeedback> {
  return evaluateQuestionRound(PET_P1_CONFIG, questionsAndAnswers, sessionId, userId);
}

export async function getPETInterviewMessagesAction(sessionId: string): Promise<{
  plan: PETInterviewPlan | null;
  qas: SpeakingQA[];
  feedback: FormativeFeedback | null;
}> {
  return readQuestionRoundMessages(PET_P1_CONFIG, sessionId);
}
