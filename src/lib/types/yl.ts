import { z } from 'zod';
import type { EvalResponse } from '@/lib/types/practice';

export type YLExam = 'starters' | 'movers';

/** Plan returned by Gemini for Parts 1–5. Shape varies by part. */
export const PointingCueSchema = z.object({
  target_index: z.number().int().min(0),
  text: z.string(),
});

export const YLPlanSchema = z.object({
  cues: z.array(z.string()).min(1),
  image_prompts: z.array(z.string()).optional(),
  character_description: z.string().optional(),
  story_title: z.string().optional(),
  story_beats: z.array(z.string()).optional(),
  // Info-exchange (Movers P2)
  student_card: z.record(z.string(), z.string()).optional(),
  examiner_card: z.record(z.string(), z.string()).optional(),
  target_questions: z.array(z.string()).optional(),
  // Pointing (Starters P1)
  options: z.array(z.string()).optional(),
  option_image_prompts: z.array(z.string()).optional(),
  pointing_cues: z.array(PointingCueSchema).optional(),
});

export type YLPlan = z.infer<typeof YLPlanSchema>;

export type YLTurnEvalResult = EvalResponse & { reaction: string; transcript: string };
