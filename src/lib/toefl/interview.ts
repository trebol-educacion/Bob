import { z } from 'zod';
import { FormativeFeedbackSchema, type FormativeFeedback } from '@/lib/types/practice';

export const INTERVIEW_ANSWER_KIND = 'speaking_answer';
export const INTERVIEW_EVALUATION_KIND = 'interview_evaluation';

export const ToeflQuestionSchema = z.object({
  text: z.string(),
  difficulty: z.number().min(1).max(4),
  suggested_time: z.number(),
});

export const ToeflInterviewPlanSchema = z.object({
  topic_id: z.string(),
  topic_name: z.string(),
  topic_context: z.string(),
  questions: z.array(ToeflQuestionSchema).length(4),
});

export type ToeflInterviewPlan = z.infer<typeof ToeflInterviewPlanSchema>;

export interface RestorableInterviewMessage {
  role: string;
  msg_type: string;
  content_json?: unknown;
}

export interface RestoredInterview {
  plan: ToeflInterviewPlan;
  evaluations: FormativeFeedback[];
  finished: boolean;
}

const CRITERIA = ['task_coverage', 'grammar', 'vocabulary', 'fluency'] as const;

type Rubric = Record<(typeof CRITERIA)[number], number>;

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * @param feedbacks - per-question feedbacks
 * @returns mean of each rubric criterion over the feedbacks that carry one, or null without any
 */
export function averageRubric(feedbacks: FormativeFeedback[]): Rubric | null {
  const rubrics = feedbacks.flatMap((feedback) => (feedback.rubric ? [feedback.rubric] : []));
  if (rubrics.length === 0) return null;
  const rubric = { ...Object.fromEntries(CRITERIA.map((criterion) => [criterion, 0])) } as Rubric;
  for (const criterion of CRITERIA) {
    rubric[criterion] = roundTenth(rubrics.reduce((sum, entry) => sum + entry[criterion], 0) / rubrics.length);
  }
  return rubric;
}

/**
 * @param evaluations - per-question feedbacks
 * @returns final evaluation payload carrying the averaged rubric, or null without graded answers
 */
export function buildInterviewEvaluation(evaluations: FormativeFeedback[]): Record<string, unknown> | null {
  const rubric = averageRubric(evaluations);
  if (!rubric) return null;
  return {
    kind: INTERVIEW_EVALUATION_KIND,
    summary: true,
    questionsAnswered: evaluations.length,
    highlights: evaluations.flatMap((feedback) => feedback.highlights),
    suggestions: evaluations.flatMap((feedback) => feedback.suggestions),
    rubric,
  };
}

/**
 * @param messages - stored messages of an interview session
 * @returns plan, per-question feedbacks in order and whether it was closed; null without a plan
 */
export function restoreInterview(messages: RestorableInterviewMessage[]): RestoredInterview | null {
  let plan: ToeflInterviewPlan | null = null;
  const byIndex = new Map<number, FormativeFeedback>();
  let finished = false;
  for (const message of messages) {
    if (message.role !== 'bob') continue;
    const json = message.content_json as Record<string, unknown> | null;
    if (!json) continue;
    if (message.msg_type === 'phrase' && plan === null) {
      const parsed = ToeflInterviewPlanSchema.safeParse(json);
      if (parsed.success) plan = parsed.data;
      continue;
    }
    if (message.msg_type !== 'evaluation') continue;
    if (json.is_final === true) finished = true;
    if (typeof json.questionIndex === 'number') {
      const parsed = FormativeFeedbackSchema.safeParse(json);
      if (parsed.success) byIndex.set(json.questionIndex, parsed.data);
    }
  }
  if (!plan) return null;
  const evaluations = [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, feedback]) => feedback);
  return { plan, evaluations, finished };
}
