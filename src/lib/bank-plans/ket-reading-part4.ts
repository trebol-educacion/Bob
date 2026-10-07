import { z } from 'zod';

const GapItemSchema = z.object({
  number: z.number().int().min(1).max(6),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1) }),
  answer: z.enum(['A', 'B', 'C']),
});

export const KetVocabGapPlanSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  items: z.array(GapItemSchema).length(6),
});

export type KetVocabGapItem = z.infer<typeof GapItemSchema>;
export type KetVocabGapPlan = z.infer<typeof KetVocabGapPlanSchema>;
