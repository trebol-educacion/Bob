import { z } from 'zod';

export const TOEFL_BUILD_ITEMS = 10;

export const ToeflBuildSentencePlanSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.union([z.number(), z.string()]),
        structure: z.string().min(1),
        tokens: z.array(z.string().min(1)).min(4).max(14),
        correct_sentence: z.string().min(1),
        explanation: z.string().min(1),
      }),
    )
    .length(TOEFL_BUILD_ITEMS),
});

export type ToeflBuildSentencePlan = z.infer<typeof ToeflBuildSentencePlanSchema>;
