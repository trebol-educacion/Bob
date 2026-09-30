'use server';

import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini, isOk } from '@/lib/gemini-client';
import { getOrCreateCachedContent } from '@/lib/cache';
import { MODELS } from '@/lib/models';
import { persistMessage, readSessionMessages } from '@/lib/persist-activity';
import { createSessionAction } from '@/actions/sessions';
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
  readFcePart2Plan,
  toFcePart2EvaluationJson,
  toFcePart2Feedback,
  toFcePart2Plan,
  type FcePart2Generation,
  type FcePart2Start,
} from '@/lib/writing/fce-part2';

const GENERATION_KEY = 'cambridge_fce_writing_part2_b2_generation';
const EVALUATION_KEY = 'cambridge_fce_writing_part2_b2_evaluation';
const FRAMING_KEY = 'cambridge_fce_writing_part2_b2_framing';
const FALLBACK_FRAMING =
  'You will write ONE text in English (140-190 words) chosen from three tasks. Read each situation, choose the one you feel most confident about, and use the right register and format for that type of text.';

async function generateTasks(userId: string): Promise<FcePart2Generation> {
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
  if (!isOk(result)) throw new Error('generation_failed');
  const rawText = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return FcePart2GenerationSchema.parse(JSON.parse(rawText));
}

function isValidGeneration(value: FcePart2Generation): boolean {
  return FcePart2GenerationSchema.safeParse(value).success;
}

export async function startFCEWritingPart2Action(): Promise<FcePart2Start | { error: string }> {
  const session = await createSessionAction({
    mode: 'cambridge_fce_writing_part2',
    title: 'Writing Part 2, Choice task',
  });
  if (!session.data) return { error: session.error ?? 'Could not create session' };
  const { id: sessionId, user_id: userId } = session.data;

  const variant = Math.floor(Math.random() * FCE_PART2_POOL_SIZE);
  const [generation, framingText] = await Promise.all([
    getOrCreateCachedContent<FcePart2Generation>(
      { kind: 'plan', promptKey: GENERATION_KEY, inputs: { variant } },
      () => generateTasks(userId),
      { validate: isValidGeneration },
    ),
    getPrompt(FRAMING_KEY).catch(() => FALLBACK_FRAMING),
  ]);
  if ('error' in generation) return { error: 'Could not generate the exercise' };

  const plan = toFcePart2Plan(generation, framingText);
  await persistMessage({
    sessionId,
    userId,
    role: 'bob',
    msgType: 'text',
    contentJson: {
      kind: FCE_PART2_PLAN_KIND,
      title: generation.title,
      instructions: generation.instructions,
      tasks: generation.tasks,
      framing_text: framingText,
    },
  });

  return { ...plan, sessionId, userId };
}

export async function submitFCEWritingPart2Action(input: {
  sessionId: string;
  taskNumber: number;
  text: string;
}): Promise<WritingFormativeFeedback | { error: string }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const messages = await readSessionMessages(input.sessionId, user.id);
  const plan = messages.map((message) => readFcePart2Plan(message.content_json)).find((found) => found !== null);
  if (!plan) return { error: 'Session not found' };

  const alreadyEvaluated = messages.some((message) => {
    const json = message.content_json as Record<string, unknown> | null;
    return message.msg_type === 'evaluation' && json?.is_final === true;
  });
  if (alreadyEvaluated) return { error: 'Already submitted' };

  const task = plan.tasks.find((candidate) => candidate.number === input.taskNumber);
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
  await persistMessage({
    sessionId: input.sessionId,
    userId: user.id,
    role: 'user',
    msgType: 'text',
    contentText: input.text,
    contentJson: { kind: FCE_PART2_SUBMISSION_KIND, text: input.text, task_number: task.number },
  });
  await persistMessage({
    sessionId: input.sessionId,
    userId: user.id,
    role: 'bob',
    msgType: 'evaluation',
    contentJson: toFcePart2EvaluationJson(feedback, task.number, evaluation.fce_rubric),
  });

  return feedback;
}
