import { z } from 'zod';

/** CEFR proficiency level. */
export type CefrLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2';

/** Formative (non-graded) feedback for open speaking and writing tasks. */
export interface FormativeFeedback {
  kind: 'formative';
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  model_answer?: string;
}

export const FormativeFeedbackSchema = z.object({
  kind: z.literal('formative'),
  understood: z.boolean(),
  highlights: z.array(z.string()),
  suggestions: z.array(z.string()),
  model_answer: z.string().optional(),
});

/** Objective feedback for Listen & Repeat: word-level metrics, no subjective score. */
export interface RepetitionObjectiveFeedback {
  kind: 'repetition_objective';
  exact_repetition: boolean;
  missing_words: string[];
  extra_words: string[];
  transcribed_text: string;
  original_text: string;
}

export const RepetitionObjectiveFeedbackSchema = z.object({
  kind: z.literal('repetition_objective'),
  exact_repetition: z.boolean(),
  missing_words: z.array(z.string()),
  extra_words: z.array(z.string()),
  transcribed_text: z.string(),
  original_text: z.string(),
});

export type ModeFramework = 'generic' | 'cambridge' | 'toefl';

// PracticeMode — open string type. Valid keys follow the {framework}_{exam_part}
// pattern (e.g. 'cambridge_pet_p3', 'toefl_listen_repeat').
// Runtime source of truth: bob_prompts (BD). See decisions.md D-R1, D9-1.
// Previously a closed literal union backed by a static catalog; opened in B2
// (T2.1) of bob-core so adding a new exam does not require touching types.
export type PracticeMode = string | null;

/** Alias — non-nullable mode key (used as Record key, component prop, etc.). */
export type ModeKey = string;

/**
 * DynamicCard — single row derived from bob_prompts (BD).
 * Source of truth for what activities are visible to a student.
 * Filled by OrganizationContext via the §2.2 query of spec.md.
 * `cefr_level` is nullable to allow universal activities (e.g. generic_conversation).
 */
export interface DynamicCard {
  framework: string;
  exam_part: string;
  cefr_level: CefrLevel | null;
  label: string;
  description: string | null;
  mode_key: ModeKey;
}

export type ExamLevel = 'a2' | 'b1' | 'b2' | 'toefl';

export const BaseEvaluationResultSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
});

export const CambridgeEvaluationSchema = z.object({
  score: z.number().min(0).max(100),
  grammar: z.number().min(0).max(100),
  vocabulary: z.number().min(0).max(100),
  fluency: z.number().min(0).max(100),
  feedback: z.string(),
  strengths: z.array(z.string()),
  areas_for_improvement: z.array(z.string()),
  cefr_level: z.string().optional(),
});

export const ToeflEvaluationSchema = z.object({
  score: z.number().min(0).max(5),
  fluency: z.number().min(0).max(5),
  vocabulary: z.number().min(0).max(5),
  grammar: z.number().min(0).max(5),
  feedback: z.string(),
  transcribed_text: z.string(),
});

export const RepetitionEvaluationSchema = z.object({
  score: z.number().min(0).max(5),
  accuracy: z.number().min(0).max(5),
  pronunciation: z.number().min(0).max(5),
  feedback: z.string(),
  transcribed_text: z.string(),
  original_text: z.string(),
});

export const CollaborativeEvaluationSchema = z.object({
  score: z.number().min(0).max(100),
  task_achievement: z.number().min(0).max(100),
  interaction: z.number().min(0).max(100),
  grammar: z.number().min(0).max(100),
  vocabulary: z.number().min(0).max(100),
  feedback: z.string(),
  strengths: z.array(z.string()),
  areas_for_improvement: z.array(z.string()),
});

/** Unified EvalResponse — new shape per spec Domain 2. */
export const EvalResponseSchema = z.object({
  score: z.number().min(0),
  score_max: z.number().min(0),
  cefr_band: z.enum(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']),
  toefl_band: z.number().min(1).max(6).nullish(),
  band_per_criterion: z
    .object({
      grammar_and_vocabulary:     z.number().min(0).max(5).nullish(),
      pronunciation:              z.number().min(0).max(5).nullish(),
      interactive_communication:  z.number().min(0).max(5).nullish(),
      discourse_management:       z.number().min(0).max(5).nullish(),
    })
    .nullish(),
  feedback: z.string(),
  model_answer: z.string().nullish(),
});

export type EvalResponse = z.infer<typeof EvalResponseSchema>;

export type BaseEvaluationResult = z.infer<typeof BaseEvaluationResultSchema>;
export type CambridgeEvaluation = z.infer<typeof CambridgeEvaluationSchema>;
export type ToeflEvaluation = z.infer<typeof ToeflEvaluationSchema>;
export type RepetitionEvaluation = z.infer<typeof RepetitionEvaluationSchema>;
export type CollaborativeEvaluation = z.infer<typeof CollaborativeEvaluationSchema>;

/** Deterministic result for a single closed-comprehension item (no LLM involved). */
export interface ClosedEvaluation {
  kind: 'closed';
  correct: boolean;
  selected: string;
  expected: string;
  explanation: string | null;
}

/** Schema for a single row in bob_closed_items. */
export const ClosedItemSchema = z.object({
  id: z.string(),
  framework: z.string(),
  exam_part: z.string(),
  cefr_level: z.enum(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']).nullable(),
  variant_id: z.string(),
  stimulus_audio_url: z.string().nullable(),
  stimulus_text: z.string().nullable(),
  stimulus_image_url: z.string().nullable(),
  question: z.string(),
  options: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      image_url: z.string().optional(),
    })
  ),
  correct_key: z.string(),
  explanation: z.string().nullable(),
  source: z.enum(['curated', 'official', 'generated_then_curated']),
});

/** Single row from bob_closed_items; shape mirrors the Zod schema above. */
export type ClosedItem = z.infer<typeof ClosedItemSchema>;
