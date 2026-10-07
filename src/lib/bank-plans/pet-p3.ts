import { z } from 'zod';

export const PetCollaborativePlanSchema = z.object({
  topic: z.string().min(1),
  situation: z.string().min(1),
  prompt_question: z.string().min(1),
  options: z.array(z.string().min(1)).length(5),
});

export type PetCollaborativePlan = z.infer<typeof PetCollaborativePlanSchema>;
