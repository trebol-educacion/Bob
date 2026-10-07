import { z } from 'zod';

const GapSchema = z.object({
  number: z.number().int().min(1).max(6),
  answer: z.string().min(1),
  accept: z.array(z.string()).default([]),
});

export const PetGapFillDraftSchema = z.object({
  context: z.string().min(1),
  summary_title: z.string().min(1),
  transcript: z.string().min(1),
  summary: z.string().min(1),
  gaps: z.array(GapSchema).length(6),
  word_bank: z.array(z.string().min(1)).min(6).max(12),
  audio_url: z.string().optional(),
});

export const PetGapFillPlanSchema = PetGapFillDraftSchema.extend({ audio_url: z.string().min(1) });

export type PetGapFillDraft = z.infer<typeof PetGapFillDraftSchema>;
export type PetGapFillPlan = z.infer<typeof PetGapFillPlanSchema>;
