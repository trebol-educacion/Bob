import { z } from 'zod';

const ItemSchema = z.object({
  number: z.number().int().min(1).max(6),
  monologue: z.string().min(1),
  question: z.string().min(1),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1) }),
  answer: z.enum(['A', 'B', 'C']),
  audio_url: z.string().optional(),
});

export const PetAttitudeDraftSchema = z.object({
  context: z.string().min(1),
  items: z.array(ItemSchema).length(6),
});

export const PetAttitudePlanSchema = PetAttitudeDraftSchema.extend({
  items: z.array(ItemSchema.extend({ audio_url: z.string().min(1) })).length(6),
});

export type PetAttitudeDraft = z.infer<typeof PetAttitudeDraftSchema>;
export type PetAttitudePlan = z.infer<typeof PetAttitudePlanSchema>;
