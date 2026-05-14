import { z } from 'zod';
import type { EvalResponse } from '@/lib/types/practice';

export type YLExam = 'starters' | 'movers';

/** Plan returned by Gemini for Parts 1–5. Shape varies by part. */
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
});

export type YLPlan = z.infer<typeof YLPlanSchema>;

export type YLTurnEvalResult = EvalResponse & { reaction: string };
