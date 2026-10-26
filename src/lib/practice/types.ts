import type { CefrLevel } from '@/lib/types/practice';

export type PracticeActivityMode = 'conversation' | 'situation' | 'picture' | 'presentation';

export interface PracticeSeed {
  angle: string;
  character: string;
  tone: string;
  topic: string;
}

export interface PracticeLegacyRubricDetail {
  participation: number;
  fluency: number;
  independence: number;
  comprehension: number;
}

export interface PracticeCriteriaRubricDetail {
  pronunciation: number | null;
  fluency: number;
  grammar: number;
  vocabulary: number;
}

export type PracticeRubricDetail = PracticeLegacyRubricDetail | PracticeCriteriaRubricDetail;

/**
 * @param detail - rubric detail stored with a practice session
 * @returns true when it carries the four-criteria format
 */
export function isCriteriaDetail(detail: PracticeRubricDetail): detail is PracticeCriteriaRubricDetail {
  return 'grammar' in detail && 'vocabulary' in detail;
}

export interface PracticeSession {
  id: string;
  user_id: string;
  organization_id: string | null;
  mode: PracticeActivityMode;
  topic: string | null;
  cefr_level: CefrLevel | null;
  seed: PracticeSeed | null;
  started_at: string;
  ended_at: string | null;
  turn_count: number;
  rubric_score: number | null;
  rubric_detail: PracticeRubricDetail | null;
}

export interface PracticeMessage {
  id: string;
  session_id: string;
  role: 'bob' | 'student';
  content: string;
  audio_url: string | null;
  hint_used: boolean;
  model_answer_used: boolean;
  created_at: string;
}

export interface PracticeImage {
  id: string;
  session_id: string;
  prompt: string;
  image_url: string;
  model: string;
  created_at: string;
}

/**
 * @template T
 */
export type PracticeResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; degraded?: boolean };
