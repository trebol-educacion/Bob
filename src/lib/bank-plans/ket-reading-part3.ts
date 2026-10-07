import { z } from 'zod';

const ItemSchema = z.object({
  number: z.number().int().min(1).max(6),
  question: z.string().min(1),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1) }),
  answer: z.enum(['A', 'B', 'C']),
});

export const KetLongTextPlanSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  items: z.array(ItemSchema).length(6),
});

export type KetLongTextItem = z.infer<typeof ItemSchema>;
export type KetLongTextPlan = z.infer<typeof KetLongTextPlanSchema>;
