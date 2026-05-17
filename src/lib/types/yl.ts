import { z } from 'zod';
import type { EvalResponse } from '@/lib/types/practice';

export type YLExam = 'starters' | 'movers';

/** Plan returned by Gemini for Parts 1–5. Shape varies by part. */
export const PointingCueSchema = z.object({
  target_index: z.number().int().min(0),
  text: z.string(),
});

/** One question within a What's This? object card. */
export const WhatsThisQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  expected: z.string().optional(),
  expected_kind: z.string().optional(),
});

/** One object card in the What's This? activity (Starters Part 3). */
export const WhatsThisCardSchema = z.object({
  word: z.string(),
  image_prompt: z.string(),
  questions: z.array(WhatsThisQuestionSchema),
});

export type WhatsThisCard = z.infer<typeof WhatsThisCardSchema>;

/** One difference entry for Movers Part 1 "Find the Differences". */
export const FindDifferenceSchema = z.object({
  id: z.string(),
  object_word: z.string(),
  property: z.string(),
  value_a: z.string(),
  value_b: z.string(),
  examiner_cue: z.string(),
  expected_answer: z.string(),
});

export type FindDifference = z.infer<typeof FindDifferenceSchema>;

export const YLPlanSchema = z.object({
  cues: z.array(z.string()).default([]),
  image_prompts: z.array(z.string()).optional(),
  character_description: z.string().optional(),
  story_title: z.string().optional(),
  story_beats: z.array(z.string()).optional(),
  student_card: z.record(z.string(), z.string()).optional(),
  examiner_card: z.record(z.string(), z.string()).optional(),
  target_questions: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
  option_image_prompts: z.array(z.string()).optional(),
  pointing_cues: z.array(PointingCueSchema).optional(),
  object_cards: z.array(WhatsThisCardSchema).optional(),
  differences: z.array(FindDifferenceSchema).optional(),
});

export type YLPlan = z.infer<typeof YLPlanSchema>;

export type YLTurnEvalResult = EvalResponse & { reaction: string; transcript: string };
