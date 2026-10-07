import { z } from 'zod';

export const KET_SHORT_ITEMS = 5;
export const ABC_KEYS = ['A', 'B', 'C'] as const;

const TurnSchema = z.object({ speaker: z.enum(['M', 'W']), line: z.string().min(1) });

const ItemSchema = z.object({
  number: z.number().int().min(1).max(KET_SHORT_ITEMS),
  context: z.string().min(1),
  dialogue: z.array(TurnSchema).min(1).max(6),
  question: z.string().min(1),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1) }),
  answer: z.enum(ABC_KEYS),
  audio_url: z.string().min(1).optional(),
});

export const KetShortConversationsGenSchema = z.object({ items: z.array(ItemSchema).length(KET_SHORT_ITEMS) });

export const KetShortConversationsPlanSchema = z.object({
  items: z.array(ItemSchema.extend({ audio_url: z.string().min(1) })).length(KET_SHORT_ITEMS),
});

export type KetShortConversationsGen = z.infer<typeof KetShortConversationsGenSchema>;
export type KetShortConversationsPlan = z.infer<typeof KetShortConversationsPlanSchema>;
export type KetShortConversationItem = KetShortConversationsPlan['items'][number];
export type AbcKey = (typeof ABC_KEYS)[number];

export interface KetShortConversationPublicItem {
  number: number;
  context: string;
  question: string;
  options: KetShortConversationItem['options'];
  audio_url: string;
}

/**
 * @param plan full plan with keys and transcripts
 * @returns items the student sees, without answers or transcripts
 */
export function toPublicShortConversations(plan: KetShortConversationsPlan): KetShortConversationPublicItem[] {
  return plan.items.map(({ number, context, question, options, audio_url }) => ({ number, context, question, options, audio_url }));
}
