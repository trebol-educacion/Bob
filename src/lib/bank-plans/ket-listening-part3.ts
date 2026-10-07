import { z } from 'zod';

const TurnSchema = z.object({ speaker: z.enum(['M', 'W']), line: z.string().min(1) });

const ItemSchema = z.object({
  number: z.number().int().min(1).max(5),
  question: z.string().min(1),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1) }),
  answer: z.enum(['A', 'B', 'C']),
});

const base = z.object({
  context: z.string().min(1),
  conversation: z.array(TurnSchema).min(4),
  items: z.array(ItemSchema).length(5),
});

export const KetListenDecideGenSchema = base.extend({ audio_url: z.string().min(1).optional() });
export const KetListenDecidePlanSchema = base.extend({ audio_url: z.string().min(1) });

export type KetListenDecideGen = z.infer<typeof KetListenDecideGenSchema>;
export type KetListenDecidePlan = z.infer<typeof KetListenDecidePlanSchema>;
