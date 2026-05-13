import { z } from 'zod';

export type PracticeMode =
  | 'situation'
  | 'image'
  | 'conversation'
  | 'b1_collaborative'
  | 'a2_part1'
  | 'toefl_listen_repeat'
  | 'toefl_interview'
  | 'b2_speaking'
  | null;

export type ModeKey = NonNullable<PracticeMode>;

export type ModeFramework = 'generic' | 'cambridge' | 'toefl';

export type CefrLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2';

export interface ModeDef {
  framework: ModeFramework;
  cefrLevels: CefrLevel[];
}

export const MODE_CATALOG: Record<ModeKey, ModeDef> = {
  situation:           { framework: 'generic',   cefrLevels: [] },
  image:               { framework: 'generic',   cefrLevels: [] },
  conversation:        { framework: 'generic',   cefrLevels: [] },
  a2_part1:            { framework: 'cambridge', cefrLevels: ['a2'] },
  b1_collaborative:    { framework: 'cambridge', cefrLevels: ['b1'] },
  b2_speaking:         { framework: 'cambridge', cefrLevels: ['b2'] },
  toefl_listen_repeat: { framework: 'toefl',     cefrLevels: ['a2', 'b1', 'b2'] },
  toefl_interview:     { framework: 'toefl',     cefrLevels: ['b1', 'b2', 'c1'] },
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

export type BaseEvaluationResult = z.infer<typeof BaseEvaluationResultSchema>;
export type CambridgeEvaluation = z.infer<typeof CambridgeEvaluationSchema>;
export type ToeflEvaluation = z.infer<typeof ToeflEvaluationSchema>;
export type RepetitionEvaluation = z.infer<typeof RepetitionEvaluationSchema>;
export type CollaborativeEvaluation = z.infer<typeof CollaborativeEvaluationSchema>;
