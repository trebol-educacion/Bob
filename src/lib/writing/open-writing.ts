import { z } from 'zod';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { MODELS } from '@/lib/models';
import { fail, ok, type ActionResult } from '@/lib/result';
import { completeActivity } from '@/lib/session/complete';
import { currentUserId } from '@/lib/session/lifecycle';
import { countWords } from '@/lib/writing/word-count';
import { OPEN_WRITING_PLAN_KIND, OPEN_WRITING_SUBMISSION_KIND } from '@/lib/writing/open-writing-restore';
import type { WritingFormativeFeedback } from '@/lib/types/practice';

const FeedbackSchema = z.object({
  understood: z.boolean(),
  highlights: z.array(z.string()),
  suggestions: z.array(z.string()),
  model_answer: z.string().optional(),
  covered_bullets: z.array(z.string()).optional(),
  missing_bullets: z.array(z.string()).optional(),
  rubric: z.object({
    task_coverage: z.number().int().min(0).max(4),
    grammar: z.number().int().min(0).max(4),
    vocabulary: z.number().int().min(0).max(4),
    fluency: z.number().int().min(0).max(4),
  }),
});

export interface OpenWritingInput {
  text: string;
  sessionId?: string;
  mode: string;
  examPart: string;
  targetWordCount: [number, number];
  instructions: string;
  examinerRole: string;
}

export interface OpenWritingOutcome {
  sessionId: string;
  feedback: WritingFormativeFeedback;
}

async function loadEvaluationPrompt(examPart: string): Promise<string | null> {
  for (const key of [examPart, `${examPart}_evaluation`]) {
    try {
      return await getPrompt(key);
    } catch {
      continue;
    }
  }
  return null;
}

function buildSystemInstruction(examinerRole: string): string {
  return `You are a ${examinerRole} providing FORMATIVE feedback only.
Never assign a numeric score outside the rubric. Return JSON with: understood (boolean), highlights (array of 2-3 strengths),
suggestions (array of 2-3 improvement points), model_answer (optional short example),
covered_bullets (optional array of task points addressed), missing_bullets (optional array of task points missed),
rubric (object with integer scores 0-4 for: task_coverage, grammar, vocabulary, fluency).`;
}

async function evaluate(input: OpenWritingInput): Promise<ActionResult<WritingFormativeFeedback>> {
  const prompt = await loadEvaluationPrompt(input.examPart);
  if (!prompt) return fail('prompt_unavailable');
  const wordCount = countWords(input.text);
  const userId = (await currentUserId()) ?? undefined;
  const result = await callGemini(
    { promptKey: input.examPart, model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [
          {
            role: 'user',
            parts: [{ text: `Exam part prompt:\n${prompt}\n\nStudent answer (${wordCount} words):\n${input.text}` }],
          },
        ],
        config: { systemInstruction: buildSystemInstruction(input.examinerRole), responseMimeType: 'application/json' },
      }),
  );
  if (!isOk(result)) return fail('evaluation_failed', true);
  const rawText = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  let parsed: z.infer<typeof FeedbackSchema>;
  try {
    parsed = FeedbackSchema.parse(JSON.parse(rawText));
  } catch {
    return fail('evaluation_unparseable', true);
  }
  return ok({
    kind: 'writing_formative',
    understood: parsed.understood,
    highlights: parsed.highlights,
    suggestions: parsed.suggestions,
    model_answer: parsed.model_answer,
    rubric: parsed.rubric,
    indicators: {
      word_count: wordCount,
      target_word_count_range: input.targetWordCount,
      covered_bullets: parsed.covered_bullets,
      missing_bullets: parsed.missing_bullets,
    },
  });
}

/**
 * @param input - submission, exam part and session mode
 * @returns formative feedback graded by rubric; the session is created after a valid evaluation and closed with its 0-10 grade
 */
export async function evaluateAndSaveOpenWriting(input: OpenWritingInput): Promise<ActionResult<OpenWritingOutcome>> {
  const evaluated = await evaluate(input);
  if (!evaluated.ok) return evaluated;
  const completed = await completeActivity({
    mode: input.mode,
    sessionId: input.sessionId,
    plan: { kind: OPEN_WRITING_PLAN_KIND, instructions: input.instructions },
    answers: [{ kind: OPEN_WRITING_SUBMISSION_KIND, text: input.text }],
    evaluation: { ...evaluated.data },
  });
  if (!completed.ok) return completed;
  return ok({ sessionId: completed.data.sessionId, feedback: evaluated.data });
}
