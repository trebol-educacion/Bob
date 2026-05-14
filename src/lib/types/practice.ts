import { z } from 'zod';

// ---------------------------------------------------------------------------
// Core CEFR + framework types
// ---------------------------------------------------------------------------

export type CefrLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2';

export type ModeFramework = 'generic' | 'cambridge' | 'toefl';

// ---------------------------------------------------------------------------
// PracticeMode — one entry per UI-selectable mode.
// Keys follow the pattern: {framework}_{exam_part} (no CEFR suffix).
// ---------------------------------------------------------------------------

export type PracticeMode =
  // Cambridge YL (A1 / A2)
  | 'cambridge_starters_part1'
  | 'cambridge_movers_part1'
  | 'cambridge_flyers_part1'
  // Cambridge KET (A2 Key)
  | 'cambridge_ket_part1'
  | 'cambridge_ket_part2'
  // Cambridge PET (B1 Preliminary)
  | 'cambridge_pet_p1'
  | 'cambridge_pet_p2'
  | 'cambridge_pet_p3'
  | 'cambridge_pet_p4'
  // Cambridge FCE (B2 First)
  | 'cambridge_fce_p1'
  | 'cambridge_fce_p2'
  | 'cambridge_fce_p3'
  | 'cambridge_fce_p4'
  // Cambridge CAE (C1 Advanced)
  | 'cambridge_cae_p1'
  | 'cambridge_cae_p2'
  | 'cambridge_cae_p3'
  | 'cambridge_cae_p4'
  // Cambridge CPE (C2 Proficiency)
  | 'cambridge_cpe_p1'
  | 'cambridge_cpe_p2'
  | 'cambridge_cpe_p3a'
  | 'cambridge_cpe_p3b'
  | 'cambridge_cpe_p4'
  // TOEFL iBT
  | 'toefl_listen_repeat'
  | 'toefl_interview'
  // Generic (always visible)
  | 'generic_situation'
  | 'generic_image'
  | 'generic_conversation'
  | null;

/** Alias — non-nullable mode key (used as Record key, component prop, etc.). */
export type ModeKey = NonNullable<PracticeMode>;

// ---------------------------------------------------------------------------
// ModeDef — describes framework membership and which CEFR levels trigger it.
// cefrLevels: [] means "always visible" (generic modes).
// ---------------------------------------------------------------------------

export interface ModeDef {
  framework: ModeFramework;
  cefrLevels: CefrLevel[];
}

export const MODE_CATALOG: Record<ModeKey, ModeDef> = {
  // ── Cambridge YL ──────────────────────────────────────────────────────────
  cambridge_starters_part1: { framework: 'cambridge', cefrLevels: ['a1'] },
  cambridge_movers_part1:   { framework: 'cambridge', cefrLevels: ['a1'] },
  cambridge_flyers_part1:   { framework: 'cambridge', cefrLevels: ['a2'] },

  // ── Cambridge KET (A2 Key) ────────────────────────────────────────────────
  cambridge_ket_part1: { framework: 'cambridge', cefrLevels: ['a2'] },
  cambridge_ket_part2: { framework: 'cambridge', cefrLevels: ['a2'] },

  // ── Cambridge PET (B1 Preliminary) ────────────────────────────────────────
  cambridge_pet_p1: { framework: 'cambridge', cefrLevels: ['b1'] },
  cambridge_pet_p2: { framework: 'cambridge', cefrLevels: ['b1'] },
  cambridge_pet_p3: { framework: 'cambridge', cefrLevels: ['b1'] },
  cambridge_pet_p4: { framework: 'cambridge', cefrLevels: ['b1'] },

  // ── Cambridge FCE (B2 First) ───────────────────────────────────────────────
  cambridge_fce_p1: { framework: 'cambridge', cefrLevels: ['b2'] },
  cambridge_fce_p2: { framework: 'cambridge', cefrLevels: ['b2'] },
  cambridge_fce_p3: { framework: 'cambridge', cefrLevels: ['b2'] },
  cambridge_fce_p4: { framework: 'cambridge', cefrLevels: ['b2'] },

  // ── Cambridge CAE (C1 Advanced) ────────────────────────────────────────────
  cambridge_cae_p1: { framework: 'cambridge', cefrLevels: ['c1'] },
  cambridge_cae_p2: { framework: 'cambridge', cefrLevels: ['c1'] },
  cambridge_cae_p3: { framework: 'cambridge', cefrLevels: ['c1'] },
  cambridge_cae_p4: { framework: 'cambridge', cefrLevels: ['c1'] },

  // ── Cambridge CPE (C2 Proficiency) ────────────────────────────────────────
  cambridge_cpe_p1:  { framework: 'cambridge', cefrLevels: ['c2'] },
  cambridge_cpe_p2:  { framework: 'cambridge', cefrLevels: ['c2'] },
  cambridge_cpe_p3a: { framework: 'cambridge', cefrLevels: ['c2'] },
  cambridge_cpe_p3b: { framework: 'cambridge', cefrLevels: ['c2'] },
  cambridge_cpe_p4:  { framework: 'cambridge', cefrLevels: ['c2'] },

  // ── TOEFL iBT ─────────────────────────────────────────────────────────────
  toefl_listen_repeat: { framework: 'toefl', cefrLevels: ['a2', 'b1', 'b2'] },
  toefl_interview:     { framework: 'toefl', cefrLevels: ['b1', 'b2', 'c1'] },

  // ── Generic (always-visible) ───────────────────────────────────────────────
  generic_situation:    { framework: 'generic', cefrLevels: [] },
  generic_image:        { framework: 'generic', cefrLevels: [] },
  generic_conversation: { framework: 'generic', cefrLevels: [] },
};

// ---------------------------------------------------------------------------
// Evaluation response schemas
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Unified EvalResponse — new shape per spec Domain 2
// ---------------------------------------------------------------------------

export const EvalResponseSchema = z.object({
  score: z.number().min(0),
  score_max: z.number().min(0),
  cefr_band: z.enum(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']),
  toefl_band: z.number().min(1).max(6).optional(),
  band_per_criterion: z
    .object({
      grammar_and_vocabulary:     z.number().min(0).max(5).optional(),
      pronunciation:              z.number().min(0).max(5).optional(),
      interactive_communication:  z.number().min(0).max(5).optional(),
      discourse_management:       z.number().min(0).max(5).optional(),
    })
    .optional(),
  feedback: z.string(),
  model_answer: z.string().optional(),
});

export type EvalResponse = z.infer<typeof EvalResponseSchema>;

export type BaseEvaluationResult = z.infer<typeof BaseEvaluationResultSchema>;
export type CambridgeEvaluation = z.infer<typeof CambridgeEvaluationSchema>;
export type ToeflEvaluation = z.infer<typeof ToeflEvaluationSchema>;
export type RepetitionEvaluation = z.infer<typeof RepetitionEvaluationSchema>;
export type CollaborativeEvaluation = z.infer<typeof CollaborativeEvaluationSchema>;
