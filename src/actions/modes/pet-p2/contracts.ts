/**
 * PET B1 Part 2 — data contracts (schemas and types).
 */

import { z } from 'zod';

export const GenerationSchema = z.object({
  topic: z.string(),
  scene_prompt: z.string(),
  reference_vocabulary: z.object({
    place: z.array(z.string()),
    people: z.array(z.string()),
    activity: z.array(z.string()),
    objects: z.array(z.string()),
    emotions: z.array(z.string()),
    weather_setting: z.array(z.string()),
  }),
  language_bank: z.object({
    openers: z.array(z.string()),
    speculation: z.array(z.string()),
    describing_people: z.array(z.string()),
    linkers: z.array(z.string()),
  }),
});

export type PictureDescriptionReferenceVocabulary = {
  place: string[];
  people: string[];
  activity: string[];
  objects: string[];
  emotions: string[];
  weather_setting: string[];
};

export type PictureDescriptionLanguageBank = {
  openers: string[];
  speculation: string[];
  describing_people: string[];
  linkers: string[];
};

/** Full result returned after a successful generate call. */
export interface PETPictureDescriptionResult {
  sessionId: string;
  userId: string;
  topic: string;
  framingText: string;
  scenePrompt: string;
  referenceVocabulary: PictureDescriptionReferenceVocabulary;
  languageBank: PictureDescriptionLanguageBank;
  imageUrl: string;
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
    place:           z.boolean(),
    people:          z.boolean(),
    activity:        z.boolean(),
    objects:         z.boolean(),
    emotions:        z.boolean(),
    weather_setting: z.boolean(),
    clothes:         z.boolean(),
    background:      z.boolean(),
  }),
  fluency_band:   z.enum(['OK', 'Good', 'Excellent']),
  transcript_used: z.string(),
  rubric:         RubricSchema,
});

/** Qualitative feedback for a picture description attempt. */
export interface PETPictureDescriptionFeedback {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  coverage: {
    place: boolean;
    people: boolean;
    activity: boolean;
    objects: boolean;
    emotions: boolean;
    weather_setting: boolean;
    clothes: boolean;
    background: boolean;
  };
  fluency_band: 'OK' | 'Good' | 'Excellent';
  transcript_used: string;
  transcript: string;
  rubric?: z.infer<typeof RubricSchema>;
}

