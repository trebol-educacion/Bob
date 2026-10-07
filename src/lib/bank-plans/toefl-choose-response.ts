import { z } from 'zod';

export const TOEFL_CHOOSE_ITEMS = 8;

const OptionSchema = z.object({ key: z.enum(['A', 'B', 'C', 'D']), label: z.string().min(1) });

const ItemSchema = z.object({
  speaker: z.enum(['Woman', 'Man']),
  utterance: z.string().min(1),
  options: z.array(OptionSchema).length(4),
  correct_key: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().min(1),
  audio_url: z.string().optional(),
});

export const ToeflChooseResponseDraftSchema = z.object({
  items: z.array(ItemSchema).length(TOEFL_CHOOSE_ITEMS),
});

export const ToeflChooseResponsePlanSchema = z.object({
  items: z
    .array(ItemSchema.extend({ audio_url: z.string().min(1) }))
    .length(TOEFL_CHOOSE_ITEMS),
});

export type ToeflChooseResponseDraft = z.infer<typeof ToeflChooseResponseDraftSchema>;
export type ToeflChooseResponsePlan = z.infer<typeof ToeflChooseResponsePlanSchema>;
