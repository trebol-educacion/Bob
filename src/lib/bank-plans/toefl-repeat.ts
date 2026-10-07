import { z } from 'zod';

export const TOEFL_REPEAT_DURATIONS = [2, 2, 3, 3, 4, 5, 7] as const;

const DraftItemSchema = z.object({
  text: z.string().min(1),
  target_duration_seconds: z.number(),
  difficulty: z.union([z.string(), z.number()]),
  audio_url: z.string().optional(),
});

export const ToeflRepeatDraftSchema = z.object({
  items: z.array(DraftItemSchema).length(TOEFL_REPEAT_DURATIONS.length),
});

export const ToeflRepeatPlanSchema = z.object({
  items: z
    .array(
      z.object({
        text: z.string().min(1),
        difficulty: z.number().min(1).max(5),
        audio_url: z.string().min(1),
      }),
    )
    .min(5)
    .max(10),
});

export type ToeflRepeatDraft = z.infer<typeof ToeflRepeatDraftSchema>;
export type ToeflRepeatPlan = z.infer<typeof ToeflRepeatPlanSchema>;
