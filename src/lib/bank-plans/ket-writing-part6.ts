import { z } from 'zod';

export const KetShortMessagePlanSchema = z.object({
  scenario: z.string().min(1),
  recipient: z.string().min(1),
  content_points: z.array(z.string().min(1)).min(2).max(3),
  word_target: z.number().default(25),
});

export type KetShortMessagePlan = z.infer<typeof KetShortMessagePlanSchema>;
