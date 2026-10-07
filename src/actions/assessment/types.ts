/**
 * Assessment, shared type contracts.
 */

import type { Skill } from '@/lib/types/skills';

export interface AssessmentPrompt {
  turn_number: number;
  prompt_text: string;
}

export interface AssessmentWritingTask {
  prompt_text: string;
  bullet_count: number;
}

export type StartAssessmentResult =
  | { status: 'ok'; skill: 'speaking'; assessment_id: string; prompts: AssessmentPrompt[]; is_yl: boolean }
  | { status: 'ok'; skill: 'writing'; assessment_id: string; task: AssessmentWritingTask }
  | { status: 'cooldown'; days_remaining: number; available_at: string }
  | { status: 'pending' }
  | { status: 'error'; code: 'unauthenticated' | 'db_error' | 'no_prompts' | 'unsupported_skill' };

export interface SubmitSpeakingTurn {
  turn_number: number;
  prompt_key: string;
  audio_base64: string;
  mime_type: string;
  duration_ms: number;
  transcript?: string;
}

export type SubmitSpeakingResult =
  | { status: 'queued'; assessment_id: string }
  | { status: 'error'; code: 'invalid_audio' | 'unauthenticated' | 'db_error' };

export type SubmitWritingResult =
  | { status: 'queued'; assessment_id: string }
  | { status: 'error'; code: 'unauthenticated' | 'db_error' | 'text_too_short' };

export type PendingAssessmentEntry = { assessment_id: string; started_at: string | null } | null;
export type PendingAssessmentsMap = Record<Skill, PendingAssessmentEntry>;

