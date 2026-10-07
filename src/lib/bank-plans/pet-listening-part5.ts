import { z } from 'zod';

const TurnSchema = z.object({ speaker: z.enum(['M', 'W']), line: z.string().min(1) });

const StatementSchema = z
  .object({
    number: z.number().int().min(1).max(6),
    text: z.string().min(1),
    is_true: z.boolean(),
    why_options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1).optional() }).optional(),
    why_correct: z.enum(['A', 'B', 'C']).optional(),
  })
  .refine((s) => s.is_true || (s.why_options !== undefined && s.why_correct !== undefined), {
    message: 'False statements require why_options and why_correct',
  });

export const PetJustifyDraftSchema = z.object({
  context: z.string().min(1),
  audio: z.array(TurnSchema).min(2),
  statements: z.array(StatementSchema).length(6),
  audio_url: z.string().optional(),
});

export const PetJustifyPlanSchema = PetJustifyDraftSchema.extend({ audio_url: z.string().min(1) });

export type PetJustifyDraft = z.infer<typeof PetJustifyDraftSchema>;
export type PetJustifyPlan = z.infer<typeof PetJustifyPlanSchema>;
