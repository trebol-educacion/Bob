/**
 * FCE B2 Part 2 — data contracts (schemas and types).
 */

import { z } from 'zod';

export const GenerationSchema = z.object({
  topic: z.string(),
  comparison_question: z.string(),
  scene_prompt_a: z.string(),
  scene_prompt_b: z.string(),
  reference_vocabulary: z.object({
    comparison: z.array(z.string()),
    speculation: z.array(z.string()),
    activity_verbs: z.array(z.string()),
    emotions: z.array(z.string()),
    settings: z.array(z.string()),
  }),
  language_bank: z.object({
    openers: z.array(z.string()),
    contrast: z.array(z.string()),
    speculation: z.array(z.string()),
    conclusion: z.array(z.string()),
  }),
});

export type FCELongTurnReferenceVocabulary = {
  comparison: string[];
  speculation: string[];
  activity_verbs: string[];
  emotions: string[];
  settings: string[];
};

export type FCELongTurnLanguageBank = {
  openers: string[];
  contrast: string[];
  speculation: string[];
  conclusion: string[];
};

/** Full result returned after a successful generate call. */
export interface FCELongTurnResult {
  sessionId: string;
  userId: string;
  topic: string;
  framingText: string;
  comparisonQuestion: string;
  scenePromptA: string;
  scenePromptB: string;
  referenceVocabulary: FCELongTurnReferenceVocabulary;
  languageBank: FCELongTurnLanguageBank;
  imageUrlA: string;
  imageUrlB: string;
}

const RubricSchema = z
  .object({
    task_coverage: z.number().int().min(0).max(4),
    grammar:       z.number().int().min(0).max(4),
    vocabulary:    z.number().int().min(0).max(4),
    fluency:       z.number().int().min(0).max(4),
  })
  .optional();

export const EvaluationSchema = z.object({
  transcript:     z.string().default(''),
  understood:     z.boolean(),
  highlights:     z.array(z.string()),
  suggestions:    z.array(z.string()),
  coverage: z.object({
    introduction:      z.boolean(),
    comparison:        z.boolean(),
    contrast:          z.boolean(),
    speculation:       z.boolean(),
    addressed_question: z.boolean(),
    conclusion:        z.boolean(),
  }),
  fluency_band:    z.enum(['OK', 'Good', 'Excellent']),
  language_band:   z.enum(['OK', 'Good', 'Excellent']),
  transcript_used: z.string(),
  rubric:          RubricSchema,
});

/** Qualitative feedback for a FCE Long Turn attempt. */
export interface FCELongTurnFeedback {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  coverage: {
    introduction: boolean;
    comparison: boolean;
    contrast: boolean;
    speculation: boolean;
    addressed_question: boolean;
    conclusion: boolean;
  };
  fluency_band: 'OK' | 'Good' | 'Excellent';
  language_band: 'OK' | 'Good' | 'Excellent';
  transcript_used: string;
  transcript: string;
  rubric?: z.infer<typeof RubricSchema>;
}

