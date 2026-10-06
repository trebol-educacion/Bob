import { z } from 'zod';
import type { WritingFormativeFeedback } from '@/lib/types/practice';
import { FceRubricSchema, buildFceScorePayload, type FceRubric } from '@/lib/writing/fce-rubric';

export const FCE_PART2_WORD_RANGE: [number, number] = [140, 190];
export const FCE_PART2_TASK_COUNT = 3;
export const FCE_PART2_POOL_SIZE = 6;
export const FCE_PART2_PLAN_KIND = 'writing_tasks';
export const FCE_PART2_SUBMISSION_KIND = 'writing_submission';

export const FCE_PART2_TASK_TYPES = ['article', 'email_letter', 'report', 'review'] as const;

export type FcePart2TaskType = (typeof FCE_PART2_TASK_TYPES)[number];

export interface FcePart2Task {
  number: number;
  taskType: FcePart2TaskType;
  situation: string;
  register: string;
}

export interface FcePart2Plan {
  title: string;
  instructions: string;
  tasks: FcePart2Task[];
  framingText: string;
}

export interface FCEWritingPart2Submission {
  sessionId: string;
  feedback: WritingFormativeFeedback;
}

const TaskSchema = z.object({
  number: z.number().int(),
  task_type: z.enum(FCE_PART2_TASK_TYPES),
  situation: z.string().min(1),
  register: z.string().default(''),
});

export const FcePart2GenerationSchema = z
  .object({
    title: z.string(),
    instructions: z.string(),
    tasks: z.array(TaskSchema).length(FCE_PART2_TASK_COUNT),
  })
  .refine((plan) => new Set(plan.tasks.map((task) => task.task_type)).size === FCE_PART2_TASK_COUNT, {
    message: 'task types must be different',
  });

export type FcePart2Generation = z.infer<typeof FcePart2GenerationSchema>;

export const FcePart2EvaluationSchema = z.object({
  understood: z.boolean(),
  register_ok: z.boolean().optional(),
  highlights: z.array(z.string()),
  suggestions: z.array(z.string()),
  model_answer: z.string().nullable().optional(),
  fce_rubric: FceRubricSchema,
});

export type FcePart2Evaluation = z.infer<typeof FcePart2EvaluationSchema>;

/**
 * @param generation validated model output
 * @param framingText framing shown above the tasks
 * @returns plan with camelCase tasks
 */
export function toFcePart2Plan(generation: FcePart2Generation, framingText: string): FcePart2Plan {
  return {
    title: generation.title,
    instructions: generation.instructions,
    framingText,
    tasks: generation.tasks.map((task) => ({
      number: task.number,
      taskType: task.task_type,
      situation: task.situation,
      register: task.register,
    })),
  };
}

/**
 * @param evaluation validated model output
 * @param wordCount words in the student text
 * @returns formative feedback carrying the 0-10 mark computed from the rubric
 */
export function toFcePart2Feedback(evaluation: FcePart2Evaluation, wordCount: number): WritingFormativeFeedback {
  const payload = buildFceScorePayload(evaluation.fce_rubric);
  return {
    kind: 'writing_formative',
    understood: evaluation.understood,
    highlights: evaluation.highlights,
    suggestions: evaluation.suggestions,
    model_answer: evaluation.model_answer ?? undefined,
    score_10: payload.score_10,
    fce_rubric: evaluation.fce_rubric,
    indicators: { word_count: wordCount, target_word_count_range: FCE_PART2_WORD_RANGE },
  };
}

/**
 * @param feedback feedback with mark
 * @param taskNumber chosen task
 * @param rubric rubric the mark comes from
 * @returns content persisted as the final evaluation message
 */
export function toFcePart2EvaluationJson(
  feedback: WritingFormativeFeedback,
  taskNumber: number,
  rubric: FceRubric,
): Record<string, unknown> {
  return {
    ...feedback,
    ...buildFceScorePayload(rubric),
    task_number: taskNumber,
    is_final: true,
  };
}

/**
 * @param raw content_json of a stored message
 * @returns the plan when the message is a Part 2 task set
 */
export function readFcePart2Plan(raw: unknown): FcePart2Plan | null {
  if (!raw || typeof raw !== 'object') return null;
  const json = raw as Record<string, unknown>;
  if (json.kind !== FCE_PART2_PLAN_KIND) return null;
  const parsed = FcePart2GenerationSchema.safeParse(json);
  if (!parsed.success) return null;
  return toFcePart2Plan(parsed.data, String(json.framing_text ?? ''));
}
