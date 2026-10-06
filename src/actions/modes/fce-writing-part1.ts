'use server';

import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { pickContent } from '@/lib/item-bank/content-source';
import { fail, ok, type ActionResult } from '@/lib/result';
import { toEssayTask, type EssayTask } from '@/lib/writing/fce-essay-bank';
import { ensureSession, finishSession, recordTurn } from '@/lib/session/lifecycle';
import { requestFceEvaluation } from '@/lib/writing/fce-evaluation';
import { countWords } from '@/lib/writing/word-count';
import { buildFceScorePayload, parseFceRubric, type FceRubric } from '@/lib/writing/fce-rubric';

const FCE_ESSAY_MODE = 'cambridge_fce_writing_part1';
const FCE_ESSAY_PART = 'fce_writing_part1';
const FRAMING_FALLBACK =
  'You will write a balanced essay in English (140-190 words). Bob will give you a title with two notes and one space for your own idea. Discuss both sides if relevant and finish with a conclusion. Use semi-formal language: firstly, moreover, however, in conclusion.';

export interface FCEEssayPrompt extends EssayTask {
  framingText: string;
}

export interface FCEEssayEvaluation {
  sessionId: string;
  feedback: FCEEssayFeedback;
}

export interface FCEEssayFeedback {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  notesCovered: [boolean, boolean, boolean];
  organization: 'OK' | 'Good' | 'Excellent';
  register: 'OK' | 'Good' | 'Excellent';
  modelAnswer: string | null;
  rubric?: z.infer<typeof RubricSchema>;
  score10: number | null;
  fceRubric: FceRubric | null;
}

const RubricSchema = z
  .object({
    task_coverage: z.number().int().min(0).max(4),
    grammar:       z.number().int().min(0).max(4),
    vocabulary:    z.number().int().min(0).max(4),
    fluency:       z.number().int().min(0).max(4),
  })
  .optional();

const EvaluationSchema = z.object({
  understood:    z.boolean(),
  highlights:    z.array(z.string()),
  suggestions:   z.array(z.string()),
  notes_covered: z.array(z.boolean()).length(3),
  organization:  z.enum(['OK', 'Good', 'Excellent']),
  register:      z.enum(['OK', 'Good', 'Excellent']),
  model_answer:  z.string().nullable().optional(),
  rubric:        RubricSchema,
  fce_rubric:    z.unknown().optional(),
});

function buildFallbackFeedback(): FCEEssayFeedback {
  return {
    understood: false,
    highlights: [],
    suggestions: ['Please try again.'],
    notesCovered: [false, false, false],
    organization: 'OK',
    register: 'OK',
    modelAnswer: null,
    score10: null,
    fceRubric: null,
  };
}

/** Reads one pregenerated essay task from the bank; no model call and no session row. */
export async function generateFCEEssayAction(): Promise<ActionResult<FCEEssayPrompt>> {
  const picked = await pickContent({
    framework: 'fce',
    cefr: 'b2',
    examPart: FCE_ESSAY_PART,
    purpose: 'practice',
    groupsOnly: true,
    skill: 'writing',
  });
  if (!picked.ok) return picked;
  const prompt = toEssayTask(picked.data);
  if (!prompt) return fail('no_content');
  const framingText = await getPrompt('cambridge_fce_writing_part1_b2_framing').catch(() => FRAMING_FALLBACK);
  return ok({ ...prompt, framingText });
}

export async function evaluateFCEEssayAction(input: {
  sessionId?: string;
  prompt: FCEEssayPrompt;
  userText: string;
}): Promise<FCEEssayEvaluation | { error: string }> {
  const { prompt } = input;
  const wordCount = countWords(input.userText);
  const notesJoined = prompt.notes
    .map((n) => `${n.id}. ${n.label}: ${n.description}`)
    .join('\n');

  const session = await ensureSession({ mode: FCE_ESSAY_MODE, sessionId: input.sessionId });
  if (!session.ok) return { error: session.code };
  const ref = { sessionId: session.data.sessionId, userId: session.data.userId };

  const promptMessages = session.data.created
    ? [
        {
          role: 'bob' as const,
          msgType: 'text' as const,
          contentText: null,
          contentJson: {
            kind: 'essay_prompt',
            exam_part: FCE_ESSAY_PART,
            bank_group_id: prompt.bankGroupId,
            title: prompt.title,
            essay_question: prompt.essayQuestion,
            context: prompt.context,
            notes: prompt.notes,
            word_target_min: prompt.wordTargetMin,
            word_target_max: prompt.wordTargetMax,
            framing_text: prompt.framingText,
          },
        },
      ]
    : [];

  const turn = await recordTurn({
    ...ref,
    messages: [
      ...promptMessages,
      {
        role: 'user',
        msgType: 'text',
        contentText: input.userText,
        contentJson: { kind: 'writing_submission', text: input.userText },
      },
    ],
  });
  if (!turn.ok) return { error: turn.code };

  const parsed = await requestFceEvaluation({
    promptKey: 'cambridge_fce_writing_part1_b2_evaluation',
    variables: {
      ESSAY_TITLE: prompt.title,
      NOTES_JOINED: notesJoined,
      USER_TEXT: input.userText,
      WORD_COUNT: String(wordCount),
    },
    userId: ref.userId,
    schema: EvaluationSchema,
  });
  if (!parsed) return { sessionId: ref.sessionId, feedback: buildFallbackFeedback() };

  const fceRubric = parseFceRubric(parsed.fce_rubric);
  const scorePayload = fceRubric ? buildFceScorePayload(fceRubric) : null;
  const feedback: FCEEssayFeedback = {
    understood: parsed.understood,
    highlights: parsed.highlights,
    suggestions: parsed.suggestions,
    notesCovered: parsed.notes_covered as [boolean, boolean, boolean],
    organization: parsed.organization,
    register: parsed.register,
    modelAnswer: parsed.model_answer ?? null,
    rubric: parsed.rubric,
    score10: scorePayload?.score_10 ?? null,
    fceRubric,
  };

  const finished = await finishSession({
    ...ref,
    evaluation: { ...feedback, rubric: parsed.rubric ?? null, ...scorePayload },
  });
  if (!finished.ok) return { error: finished.code };

  return { sessionId: ref.sessionId, feedback };
}
