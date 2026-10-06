import { z } from 'zod';

export const PetChallengePlanSchema = z.object({
  format: z.enum(['email', 'review', 'story']),
  title: z.string().min(1),
  theme: z.string().min(1),
  stimulus: z.string().min(1),
  task: z.string().min(1),
  guide_points: z.array(z.string().min(1)).min(3).max(4),
  min_words: z.number().default(60),
  max_words: z.number().default(100),
});

export type PetChallengePlan = z.infer<typeof PetChallengePlanSchema>;
