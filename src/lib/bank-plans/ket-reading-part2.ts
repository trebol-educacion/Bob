import { z } from 'zod';

const TextSchema = z.object({
  label: z.enum(['A', 'B', 'C']),
  author: z.string().min(1),
  text: z.string().min(1),
});

const QuestionSchema = z.object({
  number: z.number().int().min(1).max(6),
  text: z.string().min(1),
  answer: z.enum(['A', 'B', 'C']),
});

export const KetMatchPlanSchema = z.object({
  topic: z.string().min(1),
  texts: z.array(TextSchema).length(3),
  questions: z.array(QuestionSchema).length(6),
});

export type KetMatchPlan = z.infer<typeof KetMatchPlanSchema>;
