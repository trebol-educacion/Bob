/**
 * Assessment — shared type contracts.
 */

import type { Skill, AssessmentCefrBand, AssessmentConfidence, AssessmentResultSpeaking, AssessmentResultListening, AssessmentResultReading, AssessmentResultWriting, AssessmentWritingFeedback } from '@/lib/types/skills';

export interface AssessmentPrompt {
  turn_number: number;
  prompt_text: string;
}

export interface AssessmentListeningItem {
  id: string;
  audio_url: string;
  transcript: string | null;
  question: string;
  options: Array<{ key: string; label: string }>;
}

export interface AssessmentReadingItem {
  id: string;
  stimulus_text: string;
  question: string;
  options: Array<{ key: string; label: string }>;
}

export interface AssessmentWritingTask {
  prompt_text: string;
  bullet_count: number;
}

export type StartAssessmentResult =
  | { status: 'ok'; skill: 'speaking'; assessment_id: string; prompts: AssessmentPrompt[]; is_yl: boolean }
  | { status: 'ok'; skill: 'listening'; assessment_id: string; items: AssessmentListeningItem[] }
  | { status: 'ok'; skill: 'reading'; assessment_id: string; items: AssessmentReadingItem[] }
  | { status: 'ok'; skill: 'writing'; assessment_id: string; task: AssessmentWritingTask }
  | { status: 'cooldown'; days_remaining: number; available_at: string }
  | { status: 'error'; code: 'unauthenticated' | 'db_error' | 'no_prompts' | 'no_items' };

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

export interface SubmitListeningAnswer {
  item_id: string;
  selected_key: string;
}

export type SubmitListeningResult =
  | { status: 'ok'; result: AssessmentResultListening }
  | { status: 'error'; code: 'unauthenticated' | 'invalid_items' | 'db_error' };

export interface SubmitReadingAnswer {
  item_id: string;
  selected_key: string;
}

export type SubmitReadingResult =
  | { status: 'ok'; result: AssessmentResultReading }
  | { status: 'error'; code: 'unauthenticated' | 'invalid_items' | 'db_error' };

export type SubmitWritingResult =
  | { status: 'queued'; assessment_id: string }
  | { status: 'error'; code: 'unauthenticated' | 'db_error' | 'text_too_short' };

export type PendingAssessmentEntry = { assessment_id: string; started_at: string | null } | null;
export type PendingAssessmentsMap = Record<Skill, PendingAssessmentEntry>;

