'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { persistMessage, persistMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseServer } from '@/lib/supabase/server';
import { MODELS } from '@/lib/models';

const SECTIONS = ['comprehension', 'vocabulary', 'grammar'] as const;

const McqQuestionSchema = z.object({
  number: z.number().int().min(1).max(10),
  section: z.enum(SECTIONS),
  type: z.literal('mcq'),
  question: z.string(),
  options: z.object({ A: z.string(), B: z.string(), C: z.string() }),
  answer: z.enum(['A', 'B', 'C']),
  feedback: z.object({ A: z.string(), B: z.string(), C: z.string() }),
});

const OpenQuestionSchema = z.object({
  number: z.number().int().min(1).max(10),
  section: z.enum(SECTIONS),
  type: z.literal('open'),
  question: z.string(),
  accept: z.array(z.string()).min(1),
  feedback: z.string(),
});

const QuestionSchema = z.discriminatedUnion('type', [McqQuestionSchema, OpenQuestionSchema]);

const GenerationSchema = z
  .object({
    title: z.string(),
    topics: z.array(z.string()).min(1),
    text: z.string(),
    questions: z.array(QuestionSchema).length(10),
  })
  .superRefine((value, ctx) => {
    const sections = value.questions.map((q) => q.section);
    const expected = [
      ...Array(4).fill('comprehension'),
      ...Array(3).fill('vocabulary'),
      ...Array(3).fill('grammar'),
    ];
    for (let i = 0; i < expected.length; i += 1) {
      if (sections[i] !== expected[i]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'section distribution mismatch' });
        return;
      }
    }
  });

type GeneratedQuestion = z.infer<typeof QuestionSchema>;

/** A question as delivered to the client before answering — answer key and per-option feedback stripped. */
export type PETReadingClientQuestion =
  | {
      number: number;
      section: (typeof SECTIONS)[number];
      type: 'mcq';
      question: string;
      options: { A: string; B: string; C: string };
    }
  | {
      number: number;
      section: (typeof SECTIONS)[number];
      type: 'open';
      question: string;
    };

/** Full result of a successful generation call. */
export interface PETReadingComprehensionResult {
  sessionId: string;
  userId: string;
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
      section: (typeof SECTIONS)[number];
      type: 'mcq';
      chosen: 'A' | 'B' | 'C' | null;
      answer: 'A' | 'B' | 'C';
      is_correct: boolean;
      feedback: { A: string; B: string; C: string };
    }
  | {
      number: number;
      section: (typeof SECTIONS)[number];
      type: 'open';
      chosen: string;
      accept: string[];
      is_correct: boolean;
      feedback: string;
    };

/** Full submit result. */
export interface PETReadingComprehensionSubmitResult {
  correct_count: number;
  total: number;
  question_results: PETReadingQuestionResult[];
}

/** Answer payload from the client: option letter for mcq, free text for open. */
export type PETReadingAnswer = { type: 'mcq'; value: 'A' | 'B' | 'C' } | { type: 'open'; value: string };

function safeParse<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
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

/**
 * Generates one PET B1 reading passage and its 10-question bank.
 * Returns questions WITHOUT the answer key or per-option feedback; both stay
 * server-side in the persisted plan and are only revealed at submit.
 * Creates a session when none is provided.
 */
export async function generatePETReadingComprehensionAction(input: {
  sessionId?: string;
}): Promise<PETReadingComprehensionResult | { error: string }> {
  let sessionId = input.sessionId;
  let userId: string | undefined;

  if (!sessionId) {
    const result = await createSessionAction({
      mode: 'cambridge_pet_reading_comprehension',
      title: 'Reading — Comprehensive Text',
    });
    if (!result.data) return { error: result.error ?? 'Could not create session' };
    sessionId = result.data.id;
    userId = result.data.user_id;
  } else {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    userId = user.id;
  }

  const [generationPrompt, framingText] = await Promise.all([
    getPrompt('cambridge_pet_reading_comprehension_b1_generation').catch(() => null),
    getPrompt('cambridge_pet_reading_comprehension_b1_framing').catch(
      () =>
        'Vas a leer un texto corto y luego responder 10 preguntas sobre comprensión, vocabulario y gramática.'
    ),
  ]);

  if (!generationPrompt) return { error: 'Could not load generation prompt' };

  const geminiResult = await callGemini(
    { promptKey: 'cambridge_pet_reading_comprehension_b1_generation', model: MODELS.FLASH_LITE, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE,
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      })
  );

  if (!isOk(geminiResult)) return { error: 'Could not generate exercise' };

  const rawText = geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = safeParse(GenerationSchema, rawText);
  if (!parsed) return { error: 'Unexpected model response' };

  const clientQuestions = parsed.questions.map(toClientQuestion);

  persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'text',
    contentText: null,
    contentJson: {
      kind: 'pet_reading_comprehension_plan',
      framing_text: framingText,
      title: parsed.title,
      topics: parsed.topics,
      text: parsed.text,
      questions: parsed.questions,
    },
  }).catch(() => undefined);

  return {
    sessionId,
    userId,
    framingText,
    title: parsed.title,
    topics: parsed.topics,
    text: parsed.text,
    questions: clientQuestions,
  };
}

/**
 * Evaluates answers deterministically against the server-side answer key and
 * persists results. No LLM involved.
 */
export async function submitPETReadingComprehensionAction(input: {
  sessionId: string;
  userId: string;
  answers: Record<number, PETReadingAnswer>;
}): Promise<PETReadingComprehensionSubmitResult | { error: string }> {
  const supabase = await createSupabaseServer();

  const { data: planRow, error } = await supabase
    .from('bob_messages')
    .select('content_json')
    .eq('session_id', input.sessionId)
    .eq('user_id', input.userId)
    .eq('role', 'bob')
    .eq('msg_type', 'text')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !planRow) return { error: 'Could not load exercise' };

  const cj = planRow.content_json as { questions?: GeneratedQuestion[] } | null;
  const planQuestions = cj?.questions;
  if (!planQuestions || planQuestions.length === 0) return { error: 'Could not load exercise' };

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

  persistMessages(
    question_results.map((r) => ({
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'user' as const,
      msgType: 'text' as const,
      contentText: null,
      contentJson: {
        kind: 'pet_reading_comprehension_answer',
        question_number: r.number,
        chosen: r.chosen,
        is_correct: r.is_correct,
      },
    }))
  ).catch(() => undefined);

  persistMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    role: 'bob',
    msgType: 'evaluation',
    contentText: null,
    contentJson: {
      kind: 'pet_reading_comprehension_evaluation',
      score: correct_count,
      score_max: total,
      question_results,
      is_final: true,
    },
  }).catch(() => undefined);

  return { correct_count, total, question_results };
}
