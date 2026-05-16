import { z } from 'zod';

/** CEFR proficiency level. */
export type CefrLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2';

export type ModeFramework = 'generic' | 'cambridge' | 'toefl';

// PracticeMode — open string type. Valid keys follow the {framework}_{exam_part}
// pattern (e.g. 'cambridge_pet_p3', 'toefl_listen_repeat').
// Runtime source of truth: bob_prompts (BD). See decisions.md D-R1, D9-1.
// Previously a closed literal union backed by MODE_CATALOG; opened in B2 (T2.1)
// of bob-core so adding a new exam does not require touching types.
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

/**
 * ModeDef — describes framework membership and which CEFR levels trigger it.
 * cefrLevels: [] means "always visible" (generic modes).
 */
export interface ModeDef {
  framework: ModeFramework;
  cefrLevels: CefrLevel[];
}

export const MODE_CATALOG: Record<ModeKey, ModeDef> = {
  cambridge_starters_part1: { framework: 'cambridge', cefrLevels: ['a1'] },
  cambridge_starters_part2: { framework: 'cambridge', cefrLevels: ['a1'] },
  cambridge_starters_part3: { framework: 'cambridge', cefrLevels: ['a1'] },
  cambridge_starters_part4: { framework: 'cambridge', cefrLevels: ['a1'] },
  cambridge_movers_part1:   { framework: 'cambridge', cefrLevels: ['a1'] },
  cambridge_movers_part2:   { framework: 'cambridge', cefrLevels: ['a1'] },
  cambridge_movers_part3:   { framework: 'cambridge', cefrLevels: ['a1'] },
  cambridge_movers_part4:   { framework: 'cambridge', cefrLevels: ['a1'] },
  cambridge_movers_part5:   { framework: 'cambridge', cefrLevels: ['a1'] },
  cambridge_flyers_part1:   { framework: 'cambridge', cefrLevels: ['a2'] },
  cambridge_ket_part1: { framework: 'cambridge', cefrLevels: ['a2'] },
  cambridge_ket_part2: { framework: 'cambridge', cefrLevels: ['a2'] },
  cambridge_pet_p1: { framework: 'cambridge', cefrLevels: ['b1'] },
  cambridge_pet_p2: { framework: 'cambridge', cefrLevels: ['b1'] },
  cambridge_pet_p3: { framework: 'cambridge', cefrLevels: ['b1'] },
  cambridge_pet_p4: { framework: 'cambridge', cefrLevels: ['b1'] },
  cambridge_fce_p1: { framework: 'cambridge', cefrLevels: ['b2'] },
  cambridge_fce_p2: { framework: 'cambridge', cefrLevels: ['b2'] },
  cambridge_fce_p3: { framework: 'cambridge', cefrLevels: ['b2'] },
  cambridge_fce_p4: { framework: 'cambridge', cefrLevels: ['b2'] },
  cambridge_cae_p1: { framework: 'cambridge', cefrLevels: ['c1'] },
  cambridge_cae_p2: { framework: 'cambridge', cefrLevels: ['c1'] },
  cambridge_cae_p3: { framework: 'cambridge', cefrLevels: ['c1'] },
  cambridge_cae_p4: { framework: 'cambridge', cefrLevels: ['c1'] },
  cambridge_cpe_p1:  { framework: 'cambridge', cefrLevels: ['c2'] },
  cambridge_cpe_p2:  { framework: 'cambridge', cefrLevels: ['c2'] },
  cambridge_cpe_p3a: { framework: 'cambridge', cefrLevels: ['c2'] },
  cambridge_cpe_p3b: { framework: 'cambridge', cefrLevels: ['c2'] },
  cambridge_cpe_p4:  { framework: 'cambridge', cefrLevels: ['c2'] },
  toefl_listen_repeat: { framework: 'toefl', cefrLevels: ['a2', 'b1', 'b2'] },
  toefl_interview:     { framework: 'toefl', cefrLevels: ['b1', 'b2', 'c1'] },
  generic_situation:    { framework: 'generic', cefrLevels: [] },
  generic_image:        { framework: 'generic', cefrLevels: [] },
  generic_conversation: { framework: 'generic', cefrLevels: [] },
};

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

/**
 * MODE_UI_METADATA — display info for each selectable mode.
 * icon: lucide-react component name (string) — resolved at render time.
 * section: grouping label used by ModeSelection.
 */
export interface ModeUIEntry {
  /** lucide-react icon component name (e.g. 'BookOpen') */
  icon: string;
  title: string;
  description: string;
  badge: string;
  section: string;
}

export const MODE_UI_METADATA: Partial<Record<ModeKey, ModeUIEntry>> = {
  cambridge_starters_part1: {
    icon: 'Hand',
    title: 'Starters: Señalar imágenes',
    description: 'Señala y nombra objetos en una imagen colorida',
    badge: 'Pre-A1 · 3 min',
    section: 'Cambridge Young Learners',
  },
  cambridge_starters_part2: {
    icon: 'HelpCircle',
    title: 'Starters: Preguntas sobre escena',
    description: 'Responde preguntas sencillas sobre una imagen',
    badge: 'Pre-A1 · 3 min',
    section: 'Cambridge Young Learners',
  },
  cambridge_starters_part3: {
    icon: 'BookOpen',
    title: 'Starters: Historia con imágenes',
    description: 'Narra una historia sencilla con 4 imágenes',
    badge: 'Pre-A1 · 4 min',
    section: 'Cambridge Young Learners',
  },
  cambridge_starters_part4: {
    icon: 'User',
    title: 'Starters: Preguntas personales',
    description: 'Responde preguntas sobre ti mismo en inglés',
    badge: 'Pre-A1 · 3 min',
    section: 'Cambridge Young Learners',
  },
  cambridge_movers_part1: {
    icon: 'GitCompare',
    title: 'Movers: Encuentra diferencias',
    description: 'Describe las diferencias entre dos imágenes parecidas',
    badge: 'A1 · 5 min',
    section: 'Cambridge Young Learners',
  },
  cambridge_movers_part2: {
    icon: 'MessageCircle',
    title: 'Movers: Intercambio de información',
    description: 'Intercambia información con el examinador usando tarjetas',
    badge: 'A1 · 4 min',
    section: 'Cambridge Young Learners',
  },
  cambridge_movers_part3: {
    icon: 'BookImage',
    title: 'Movers: Cuenta la historia',
    description: 'Narra una historia completa con 4 imágenes secuenciales',
    badge: 'A1 · 5 min',
    section: 'Cambridge Young Learners',
  },
  cambridge_movers_part4: {
    icon: 'User',
    title: 'Movers: Preguntas personales',
    description: 'Responde preguntas personales con más detalle',
    badge: 'A1 · 3 min',
    section: 'Cambridge Young Learners',
  },
  cambridge_movers_part5: {
    icon: 'ImageIcon',
    title: 'Movers: Describe la imagen',
    description: 'Describe una imagen con vocabulario A1 variado',
    badge: 'A1 · 4 min',
    section: 'Cambridge Young Learners',
  },
};
