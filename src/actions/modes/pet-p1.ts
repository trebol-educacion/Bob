'use server';

import { PETInterviewPlanSchema, type PETInterviewPlan } from '@/lib/speaking/pet-content';
import { PET_INTERVIEW_PART } from '@/lib/speaking/pet-content';
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


const PET_P1_CONFIG: QuestionRoundConfig<PETInterviewPlan> = {
  mode: 'cambridge_pet_p1',
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

export async function generatePETInterviewAction(): Promise<ActionResult<PETInterviewPlan>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');
  return pickPetPlan({ schema: PETInterviewPlanSchema, examPart: PET_INTERVIEW_PART, userId });
}

export async function processPETInterviewAnswerAction(
  audioBase64: string,
  mimeType: string,
  question: string,
  context: QuestionRoundContext<PETInterviewPlan>,
): Promise<ActionResult<QuestionRoundAnswer>> {
  return processQuestionRoundAnswer(PET_P1_CONFIG, audioBase64, mimeType, question, context);
}

export async function evaluatePETInterviewAction(
  questionsAndAnswers: SpeakingQA[],
  context: QuestionRoundContext<PETInterviewPlan>,
): Promise<ActionResult<QuestionRoundEvaluation>> {
  return evaluateQuestionRound(PET_P1_CONFIG, questionsAndAnswers, context);
}
