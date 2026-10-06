import { z } from 'zod';

export const PetEmailPlanSchema = z.object({
  email_received: z.object({
    from: z.string().min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
  }),
  content_points: z.array(z.string().min(1)).length(4),
  word_target: z.number().default(100),
  context: z.string().default(''),
});

export type PetEmailPlan = z.infer<typeof PetEmailPlanSchema>;
