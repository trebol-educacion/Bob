import { z } from 'zod';
import { RepetitionObjectiveFeedbackSchema, type RepetitionObjectiveFeedback } from '@/lib/types/practice';

export const REPEAT_EVALUATION_KIND = 'repeat_evaluation';
export const REPEAT_ANSWER_KIND = 'speaking_answer';

export const ToeflRepeatItemSchema = z.object({
  text: z.string(),
  difficulty: z.number().min(1).max(5),
  audio_url: z.string().optional(),
});

export const ToeflRepeatSessionSchema = z.object({
  items: z.array(ToeflRepeatItemSchema).min(5).max(10),
});

export type ToeflRepeatItem = z.infer<typeof ToeflRepeatItemSchema>;

export interface RestorableRepeatMessage {
  role: string;
  msg_type: string;
  content_json?: unknown;
}

export interface RestoredRepeat {
  items: ToeflRepeatItem[];
  evaluations: Array<RepetitionObjectiveFeedback | null>;
  finished: boolean;
}

/**
 * @param feedbacks - evaluations by phrase index, null when an item has no graded attempt
 * @param total - number of items in the session
 * @returns final evaluation payload graded by exact repetitions over the total
 */
export function buildRepeatEvaluation(
  feedbacks: Array<RepetitionObjectiveFeedback | null>,
  total: number,
): Record<string, unknown> {
  const exactCount = feedbacks.filter((feedback) => feedback?.exact_repetition).length;
  return { kind: REPEAT_EVALUATION_KIND, score: exactCount, score_max: total, exactCount, totalCount: total, itemCount: total };
}

/**
 * @param messages - stored messages of a listen-and-repeat session
 * @returns items, the last evaluation per phrase and whether it was closed; null without a plan
 */
export function restoreRepeat(messages: RestorableRepeatMessage[]): RestoredRepeat | null {
  let items: ToeflRepeatItem[] | null = null;
  const byIndex = new Map<number, RepetitionObjectiveFeedback>();
  let finished = false;
  for (const message of messages) {
    if (message.role !== 'bob') continue;
    const json = message.content_json as Record<string, unknown> | null;
    if (!json) continue;
    if (message.msg_type === 'phrase' && items === null) {
      const parsed = z.array(ToeflRepeatItemSchema).safeParse(json.phrases);
      if (parsed.success) items = parsed.data;
      continue;
    }
    if (message.msg_type !== 'evaluation') continue;
    if (json.is_final === true) finished = true;
    if (typeof json.phraseIndex === 'number') {
      const parsed = RepetitionObjectiveFeedbackSchema.safeParse(json);
      if (parsed.success) byIndex.set(json.phraseIndex, parsed.data);
    }
  }
  if (!items) return null;
  return { items, evaluations: items.map((_, index) => byIndex.get(index) ?? null), finished };
}
