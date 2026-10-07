'use server';

import { PETDiscussionPlanSchema, PET_DISCUSSION_PART, type PETDiscussionPlan } from '@/lib/speaking/pet-content';
import { pickPetPlan } from '@/lib/speaking/pet-bank';
import { fail, type ActionResult } from '@/lib/result';
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


const PET_P4_CONFIG: QuestionRoundConfig<PETDiscussionPlan> = {
  mode: 'cambridge_pet_p4',
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

export async function generatePETDiscussionAction(): Promise<ActionResult<PETDiscussionPlan>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  return pickPetPlan({ schema: PETDiscussionPlanSchema, examPart: PET_DISCUSSION_PART, userId });
}

export async function processPETDiscussionAnswerAction(
  audioBase64: string,
  mimeType: string,
  question: string,
  context: QuestionRoundContext<PETDiscussionPlan>,
): Promise<ActionResult<QuestionRoundAnswer>> {
  return processQuestionRoundAnswer(PET_P4_CONFIG, audioBase64, mimeType, question, context);
}

export async function evaluatePETDiscussionAction(
  questionsAndAnswers: SpeakingQA[],
  context: QuestionRoundContext<PETDiscussionPlan>,
): Promise<ActionResult<QuestionRoundEvaluation>> {
  return evaluateQuestionRound(PET_P4_CONFIG, questionsAndAnswers, context);
}
