/**
 * Typed shapes for all Gemini JSON responses used in the application.
 * Zod schemas validate runtime shapes; TypeScript types are inferred from them.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schemas — used in Server Actions that throw on bad responses
// ---------------------------------------------------------------------------

export const PhraseGenerationSchema = z.object({
  phrases: z.array(z.string()),
});

export const ImageSceneSchema = z.object({
  topic: z.string(),
  description: z.string(),
  image_prompt: z.string(),
});

export const PronunciationEvaluationSchema = z.object({
  score: z.number(),
  feedback: z.string(),
  transcribed_text: z.string(),
});

const EvaluationDetailsSchema = z.object({
  content_coverage: z.string(),
  duration_feedback: z.string(),
  clarity: z.string(),
  improvement_tips: z.array(z.string()),
});

export const ImageDescriptionEvaluationSchema = z.object({
  score: z.number(),
  feedback: z.string(),
  transcribed_text: z.string(),
  details: EvaluationDetailsSchema,
});

export const ChatTurnSchema = z.object({
  evaluation: PronunciationEvaluationSchema,
  ai_response: z.string(),
});

// ---------------------------------------------------------------------------
// TypeScript interfaces — inferred from Zod schemas where possible,
// hand-written for shapes without a schema (fallback actions).
// ---------------------------------------------------------------------------

export type PhraseGenerationResponse = z.infer<typeof PhraseGenerationSchema>;
export type ImageSceneResponse = z.infer<typeof ImageSceneSchema>;
export type PronunciationEvaluationResponse = z.infer<typeof PronunciationEvaluationSchema>;

export interface EvaluationDetails {
  content_coverage: string;
  duration_feedback: string;
  clarity: string;
  improvement_tips: string[];
}

export type ImageDescriptionEvaluationResponse = z.infer<typeof ImageDescriptionEvaluationSchema>;
export type ChatTurnResponse = z.infer<typeof ChatTurnSchema>;

// Fallback-action types — no Zod schema needed; these use intentional catch fallbacks
export interface InitialChatResponse {
  framing: string;
  message: string;
}

export interface SimulatedConversationResponse {
  full_history: Array<{ role: 'user' | 'model'; text: string }>;
}

export interface QuestionsResponse {
  questions: Array<{ id: number; question: string; correct_answer: string }>;
}
