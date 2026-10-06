'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini } from '@/lib/gemini-client';
import { parseJsonResult } from '@/lib/llm/parse-json-result';
import type { ActionResult } from '@/lib/result';
import { getOrCreateCachedContent } from '@/lib/cache';
import { MODELS } from '@/lib/models';
import type { FCEWritingPart2Submission } from '@/lib/writing/fce-part2';
import { readSessionMessages } from '@/lib/persist-activity';
import { ensureSession, finishSession, recordTurn } from '@/lib/session/lifecycle';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requestFceEvaluation } from '@/lib/writing/fce-evaluation';
import { countWords } from '@/lib/writing/word-count';
import type { WritingFormativeFeedback } from '@/lib/types/practice';
import {
  FCE_PART2_PLAN_KIND,
  FCE_PART2_POOL_SIZE,
  FCE_PART2_SUBMISSION_KIND,
  FcePart2EvaluationSchema,
  FcePart2GenerationSchema,
  toFcePart2EvaluationJson,
  toFcePart2Feedback,
  toFcePart2Plan,
  type FcePart2Generation,
  type FcePart2Plan,
} from '@/lib/writing/fce-part2';

const FCE_PART2_MODE = 'cambridge_fce_writing_part2';
const GENERATION_KEY = 'cambridge_fce_writing_part2_b2_generation';
const EVALUATION_KEY = 'cambridge_fce_writing_part2_b2_evaluation';
const FRAMING_KEY = 'cambridge_fce_writing_part2_b2_framing';
const FALLBACK_FRAMING =
  'You will write ONE text in English (140-190 words) chosen from three tasks. Read each situation, choose the one you feel most confident about, and use the right register and format for that type of text.';

async function generateTasks(userId: string): Promise<ActionResult<FcePart2Generation>> {
  const promptText = await getPrompt(GENERATION_KEY);
  const result = await callGemini(
    { promptKey: GENERATION_KEY, model: MODELS.FLASH_LITE_PREVIEW, userId },
    (ai) =>
      ai.models.generateContent({
        model: MODELS.FLASH_LITE_PREVIEW,
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      }),
  );
  return parseJsonResult<FcePart2Generation>(
    result.ok ? { ...result, data: { text: result.data.candidates?.[0]?.content?.parts?.[0]?.text } } : result,
    FcePart2GenerationSchema,
    'generateFcePart2Tasks',
  );
}

function isValidGeneration(value: FcePart2Generation): boolean {
  return FcePart2GenerationSchema.safeParse(value).success;
}

export async function startFCEWritingPart2Action(): Promise<FcePart2Plan | { error: string }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const variant = Math.floor(Math.random() * FCE_PART2_POOL_SIZE);
  const [generation, framingText] = await Promise.all([
    getOrCreateCachedContent<FcePart2Generation>(
      { kind: 'plan', promptKey: GENERATION_KEY, inputs: { variant } },
      () => generateTasks(user.id),
      { validate: isValidGeneration },
    ),
    getPrompt(FRAMING_KEY).catch(() => FALLBACK_FRAMING),
  ]);
  if ('error' in generation) return { error: 'Could not generate the exercise' };

  return toFcePart2Plan(generation, framingText);
}

export async function submitFCEWritingPart2Action(input: {
  sessionId?: string;
  plan: FcePart2Plan;
  taskNumber: number;
  text: string;
}): Promise<FCEWritingPart2Submission | { error: string }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (input.sessionId) {
    const messages = await readSessionMessages(input.sessionId, user.id);
    const alreadyEvaluated = messages.some((message) => {
      const json = message.content_json as Record<string, unknown> | null;
      return message.msg_type === 'evaluation' && json?.is_final === true;
    });
    if (alreadyEvaluated) return { error: 'Already submitted' };
  }

  const task = input.plan.tasks.find((candidate) => candidate.number === input.taskNumber);
  if (!task) return { error: 'Unknown task' };

  const wordCount = countWords(input.text);
  const evaluation = await requestFceEvaluation({
    promptKey: EVALUATION_KEY,
    variables: {
      TASK_TEXT: task.situation,
      TASK_TYPE: task.taskType,
      USER_TEXT: input.text,
      WORD_COUNT: String(wordCount),
    },
    userId: user.id,
    schema: FcePart2EvaluationSchema,
  });
  if (!evaluation) return { error: 'Could not evaluate your text' };

  const feedback = toFcePart2Feedback(evaluation, wordCount);

  const session = await ensureSession({ mode: FCE_PART2_MODE, sessionId: input.sessionId });
  if (!session.ok) return { error: session.code };
  const ref = { sessionId: session.data.sessionId, userId: session.data.userId };

  const planMessages = session.data.created
    ? [
        {
          role: 'bob' as const,
          msgType: 'text' as const,
          contentJson: {
            kind: FCE_PART2_PLAN_KIND,
            title: input.plan.title,
            instructions: input.plan.instructions,
            tasks: input.plan.tasks.map((candidate) => ({
              number: candidate.number,
              task_type: candidate.taskType,
              situation: candidate.situation,
              register: candidate.register,
            })),
            framing_text: input.plan.framingText,
          },
        },
      ]
    : [];

  const turn = await recordTurn({
    ...ref,
    messages: [
      ...planMessages,
      {
        role: 'user',
        msgType: 'text',
        contentText: input.text,
        contentJson: { kind: FCE_PART2_SUBMISSION_KIND, text: input.text, task_number: task.number },
      },
    ],
  });
  if (!turn.ok) return { error: turn.code };

  const finished = await finishSession({
    ...ref,
    evaluation: toFcePart2EvaluationJson(feedback, task.number, evaluation.fce_rubric),
  });
  if (!finished.ok) return { error: finished.code };

  return { sessionId: ref.sessionId, feedback };
}
