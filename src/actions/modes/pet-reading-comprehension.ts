'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { bankStamp, pickPlan } from '@/lib/item-bank/plan-bank';
import {
  PET_READING_SECTIONS,
  PetReadingComprehensionPlanSchema,
  type PetReadingQuestion,
} from '@/lib/bank-plans/pet-reading-comprehension';
import { fail, ok, type ActionResult } from '@/lib/result';
import { completeActivity } from '@/lib/session/complete';
import { currentUserId } from '@/lib/session/lifecycle';
import { sealPlan, unsealPlan } from '@/lib/session/sealed-plan';

type GeneratedQuestion = PetReadingQuestion;

/** A question as delivered to the client before answering, answer key and per-option feedback stripped. */
export type PETReadingClientQuestion =
  | {
      number: number;
      section: (typeof PET_READING_SECTIONS)[number];
      type: 'mcq';
      question: string;
      options: { A: string; B: string; C: string };
    }
  | {
      number: number;
      section: (typeof PET_READING_SECTIONS)[number];
      type: 'open';
      question: string;
    };

/** Full result of a successful generation call. */
export interface PETReadingComprehensionResult {
  planToken: string;
  framingText: string;
  title: string;
  topics: string[];
  text: string;
  questions: PETReadingClientQuestion[];
}

/** Per-question deterministic result returned after submit, including the now-revealed answer key and feedback. */
export type PETReadingQuestionResult =
  | {
      number: number;
      section: (typeof PET_READING_SECTIONS)[number];
      type: 'mcq';
      chosen: 'A' | 'B' | 'C' | null;
      answer: 'A' | 'B' | 'C';
      is_correct: boolean;
      feedback: { A: string; B: string; C: string };
    }
  | {
      number: number;
      section: (typeof PET_READING_SECTIONS)[number];
      type: 'open';
      chosen: string;
      accept: string[];
      is_correct: boolean;
      feedback: string;
    };

/** Full submit result. */
export interface PETReadingComprehensionSubmitResult {
  sessionId: string;
  correct_count: number;
  total: number;
  question_results: PETReadingQuestionResult[];
}

/** Answer payload from the client: option letter for mcq, free text for open. */
export type PETReadingAnswer = { type: 'mcq'; value: 'A' | 'B' | 'C' } | { type: 'open'; value: string };

interface PETReadingPlan {
  kind: 'pet_reading_comprehension_plan';
  framing_text: string;
  title: string;
  topics: string[];
  text: string;
  questions: GeneratedQuestion[];
  bank_group_id: string;
}

function toClientQuestion(q: GeneratedQuestion): PETReadingClientQuestion {
  if (q.type === 'mcq') {
    return {
      number: q.number,
      section: q.section,
      type: 'mcq',
      question: q.question,
      options: q.options,
    };
  }
  return {
    number: q.number,
    section: q.section,
    type: 'open',
    question: q.question,
  };
}

function normalizeOpen(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'"]+$/g, '')
    .trim();
}

const FRAMING_FALLBACK = 'Vas a leer un texto corto y luego responder 10 preguntas sobre comprensión, vocabulario y gramática.';

/**
 * Reads one pregenerated PET B1 reading passage and its 10 questions from the bank.
 * Returns questions WITHOUT the answer key or per-option feedback; both stay
 * server-side in the sealed plan and are only revealed at submit.
 * No model call; persists nothing until the first submit.
 */
export async function generatePETReadingComprehensionAction(): Promise<ActionResult<PETReadingComprehensionResult>> {
  const userId = await currentUserId();
  if (!userId) return fail('unauthenticated');

  const picked = await pickPlan({
    exam: 'pet',
    cefr: 'b1',
    examPart: 'pet_reading_comprehension',
    skill: 'reading',
    schema: PetReadingComprehensionPlanSchema,
    userId,
  });
  if (!picked.ok) return picked;
  const banked = picked.data.plan;
  const framingText = await getPrompt('cambridge_pet_reading_comprehension_b1_framing').catch(() => FRAMING_FALLBACK);

  const plan: PETReadingPlan = {
    kind: 'pet_reading_comprehension_plan',
    framing_text: framingText,
    title: banked.title,
    topics: banked.topics,
    text: banked.text,
    questions: banked.questions,
    bank_group_id: picked.data.groupId,
  };

  return ok({
    planToken: sealPlan(plan, userId),
    framingText,
    title: banked.title,
    topics: banked.topics,
    text: banked.text,
    questions: banked.questions.map(toClientQuestion),
  });
}

/**
 * Evaluates answers deterministically against the sealed answer key; creates the session on this first turn.
 * No LLM involved.
 */
export async function submitPETReadingComprehensionAction(input: {
  sessionId?: string;
  planToken: string;
  answers: Record<number, PETReadingAnswer>;
}): Promise<PETReadingComprehensionSubmitResult | { error: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: 'unauthenticated' };
  const plan = unsealPlan<PETReadingPlan>(input.planToken, userId);
  const planQuestions = plan?.questions;
  if (!plan || !planQuestions || planQuestions.length === 0) return { error: 'Could not load exercise' };

  const question_results: PETReadingQuestionResult[] = planQuestions.map((q) => {
    const given = input.answers[q.number];

    if (q.type === 'mcq') {
      const chosen = given && given.type === 'mcq' ? given.value : null;
      return {
        number: q.number,
        section: q.section,
        type: 'mcq',
        chosen,
        answer: q.answer,
        is_correct: chosen === q.answer,
        feedback: q.feedback,
      };
    }

    const chosen = given && given.type === 'open' ? given.value : '';
    const normalizedChosen = normalizeOpen(chosen);
    const is_correct =
      normalizedChosen.length > 0 &&
      q.accept.some((variant) => normalizeOpen(variant) === normalizedChosen);
    return {
      number: q.number,
      section: q.section,
      type: 'open',
      chosen,
      accept: q.accept,
      is_correct,
      feedback: q.feedback,
    };
  });

  const correct_count = question_results.filter((r) => r.is_correct).length;
  const total = planQuestions.length;

  const completed = await completeActivity({
    mode: 'cambridge_pet_reading_comprehension',
    sessionId: input.sessionId,
    bank: bankStamp('pet_reading_comprehension', plan.bank_group_id),
    plan,
    answers: question_results.map((r) => ({
      kind: 'pet_reading_comprehension_answer',
      question_number: r.number,
      chosen: r.chosen,
      is_correct: r.is_correct,
    })),
    evaluation: {
      kind: 'pet_reading_comprehension_evaluation',
      score: correct_count,
      score_max: total,
      question_results,
    },
  });
  if (!completed.ok) return { error: completed.code };

  return { sessionId: completed.data.sessionId, correct_count, total, question_results };
}
