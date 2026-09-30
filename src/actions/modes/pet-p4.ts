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

const PETDiscussionPlanSchema = z.object({
  topic: z.string(),
  link: z.string(),
  questions: z.array(z.string()).min(1),
  closing: z.string(),
});

export type PETDiscussionPlan = z.infer<typeof PETDiscussionPlanSchema>;

const PET_P4_CONFIG: QuestionRoundConfig<PETDiscussionPlan> = {
  promptPrefix: 'cambridge_pet_p4_b1',
  transcribePromptKey: 'cambridge_pet_p4_b1_transcribe',
  planCacheKey: 'cambridge-pet-p4-b1-plan',
  planSchema: PETDiscussionPlanSchema,
  planFallback: {
    topic: 'Free time and hobbies',
    link: "We've been talking about hobbies. Now I'd like you to discuss something more general.",
    questions: [
      'Do you think hobbies are important? Why?',
      'Is it better to have a hobby alone or with friends? Why?',
      'Tell me about a hobby you enjoyed when you were younger.',
      'Do you prefer indoor or outdoor activities? Why?',
      'Some people say young people spend too much time on screens. Do you agree? Why or why not?',
      'What new hobby would you like to try in the future, and why?',
    ],
    closing: 'Thank you. That is the end of the Speaking Test.',
  },
  logTag: 'PET-p4',
  eventName: 'PETDiscussion',
};

export async function generatePETDiscussionAction(sessionId: string, userId: string): Promise<PETDiscussionPlan> {
  return generateQuestionRoundPlan(PET_P4_CONFIG, sessionId, userId);
}

export async function processPETDiscussionAnswerAction(
  audioBase64: string,
  mimeType: string,
  question: string,
  sessionId: string,
  userId: string,
): Promise<{ transcribed: string; reaction: string }> {
  return processQuestionRoundAnswer(PET_P4_CONFIG, audioBase64, mimeType, question, sessionId, userId);
}

export async function evaluatePETDiscussionAction(
  questionsAndAnswers: SpeakingQA[],
  sessionId: string,
  userId: string,
): Promise<FormativeFeedback> {
  return evaluateQuestionRound(PET_P4_CONFIG, questionsAndAnswers, sessionId, userId);
}

export async function getPETDiscussionMessagesAction(sessionId: string): Promise<{
  plan: PETDiscussionPlan | null;
  qas: SpeakingQA[];
  feedback: FormativeFeedback | null;
}> {
  return readQuestionRoundMessages(PET_P4_CONFIG, sessionId);
}
