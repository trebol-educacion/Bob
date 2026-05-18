import type { CefrLevel, FormativeFeedback } from './practice';

export type Skill = 'reading' | 'listening' | 'writing' | 'speaking';

export type SkillLevelOrigin =
  | 'legacy'
  | 'assessment'
  | 'manual_teacher'
  | 'manual_admin';

export interface SkillLevel {
  cefr_level: CefrLevel;
  origin: SkillLevelOrigin;
  confidence: number | null;
  last_assessment_at: string | null;
  updated_at: string;
}

export type SkillLevelMap = Partial<Record<Skill, SkillLevel>>;

export type AssessmentConfidence = 'low' | 'medium' | 'high';

export interface AssessmentSpeakingFeedback {
  kind: 'assessment_speaking';
  highlights: string[];
  suggestions: string[];
  overall_message: string;
}

export type AssessmentCefrBand = 'pre_a1' | 'a1' | 'a2' | 'b1' | 'b2';

export interface AssessmentWritingFeedback {
  strengths: string[];
  improvements: string[];
  next_step: string;
}

export interface AssessmentResultBase {
  assessment_id: string;
  skill: Skill;
  cefr_band: AssessmentCefrBand;
  confidence: AssessmentConfidence;
  feedback: FormativeFeedback | AssessmentSpeakingFeedback | AssessmentWritingFeedback;
  cooldown_until: string;
}

export interface AssessmentResultSpeaking extends AssessmentResultBase {
  skill: 'speaking';
  feedback: AssessmentSpeakingFeedback;
  pending_evaluation: boolean;
}

export interface AssessmentResultListening extends AssessmentResultBase {
  skill: 'listening';
  score: number;
  score_max: number;
  failed_item_ids: string[];
}

export interface AssessmentResultReading extends AssessmentResultBase {
  skill: 'reading';
  score: number;
  score_max: number;
  failed_item_ids: string[];
}

export interface AssessmentResultWriting extends AssessmentResultBase {
  skill: 'writing';
  bullets_covered: number;
  feedback: AssessmentWritingFeedback;
}

export type AssessmentResult =
  | AssessmentResultSpeaking
  | AssessmentResultListening
  | AssessmentResultReading
  | AssessmentResultWriting;

export interface SkillLevelHistoryEntry {
  id: number;
  user_id: string;
  skill: Skill;
  level_before: string | null;
  level_after: string;
  origin: SkillLevelOrigin;
  occurred_at: string;
  source_assessment_id?: string | null;
}
