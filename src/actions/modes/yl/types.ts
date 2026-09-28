import { z } from 'zod';

/** The kind of image generated for a YL activity. */
export type YLImageType = 'scene' | 'object_card' | 'photo_realistic';

const WhatsThisEvalResultSchema = z.object({
  score: z.number().int().min(0).max(1),
  score_max: z.number().int().default(1),
  cefr_band: z.string().default('a1'),
  correct: z.boolean(),
  reaction: z.string(),
  feedback: z.string().optional(),
  transcript_used: z.string().optional(),
});

export { WhatsThisEvalResultSchema };

/** Result of a single spoken answer evaluation in Starters Part 3, Movers Part 1, or Movers Part 3. */
export type WhatsThisEvalResult = z.infer<typeof WhatsThisEvalResultSchema> & {
  transcript: string;
};

export const WhatsThisEvalFallback: WhatsThisEvalResult = {
  score: 0,
  score_max: 1,
  cefr_band: 'a1',
  correct: false,
  reaction: "Good try! Let's keep going!",
  feedback: undefined,
  transcript_used: undefined,
  transcript: '',
};
