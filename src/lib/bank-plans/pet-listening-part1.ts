import { z } from 'zod';

const TurnSchema = z.object({ speaker: z.enum(['M', 'W']), line: z.string().min(1) });

const ItemSchema = z.object({
  number: z.number().int().min(1).max(6),
  conversation: z.array(TurnSchema).min(2).max(8),
  question: z.string().min(1),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1) }),
  answer: z.enum(['A', 'B', 'C']),
  audio_url: z.string().optional(),
});

export const PetSituationalDraftSchema = z.object({
  context: z.string().min(1),
  items: z.array(ItemSchema).length(6),
});

export const PetSituationalPlanSchema = PetSituationalDraftSchema.extend({
  items: z.array(ItemSchema.extend({ audio_url: z.string().min(1) })).length(6),
});

export type PetSituationalDraft = z.infer<typeof PetSituationalDraftSchema>;
export type PetSituationalPlan = z.infer<typeof PetSituationalPlanSchema>;
