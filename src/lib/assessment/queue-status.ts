import type { Skill } from '@/lib/types/skills';
import type { AssessmentQueueStatus } from '@/actions/assessment/types';
import { assessmentQueueFreshSince } from './queue-freshness';

export interface AssessmentQueueRow {
  skill: string;
  assessment_id: string;
  status: string;
  started_at: string | null;
  created_at: string;
}

const SKILLS: readonly Skill[] = ['speaking', 'listening', 'reading', 'writing'];
const IN_FLIGHT_STATUSES = new Set(['pending', 'processing']);

/**
 * @returns AssessmentQueueStatus
 */
export function emptyAssessmentQueueStatus(): AssessmentQueueStatus {
  return {
    pending: { speaking: null, listening: null, reading: null, writing: null },
    failed: { speaking: null, listening: null, reading: null, writing: null },
  };
}

function isSkill(value: string): value is Skill {
  return (SKILLS as readonly string[]).includes(value);
}

function latestRowPerSkill(rows: AssessmentQueueRow[]): Map<Skill, AssessmentQueueRow> {
  const latest = new Map<Skill, AssessmentQueueRow>();
  for (const row of rows) {
    if (!isSkill(row.skill)) continue;
    const current = latest.get(row.skill);
    if (!current || Date.parse(row.created_at) > Date.parse(current.created_at)) {
      latest.set(row.skill, row);
    }
  }
  return latest;
}

/**
 * @param rows AssessmentQueueRow[]
 * @param now Date
 * @returns AssessmentQueueStatus
 */
export function deriveAssessmentQueueStatus(
  rows: AssessmentQueueRow[],
  now: Date = new Date(),
): AssessmentQueueStatus {
  const result = emptyAssessmentQueueStatus();
  const freshSince = Date.parse(assessmentQueueFreshSince(now));

  for (const [skill, row] of latestRowPerSkill(rows)) {
    const inFlight = IN_FLIGHT_STATUSES.has(row.status);
    const fresh = Date.parse(row.created_at) >= freshSince;
    if (inFlight && fresh) {
      result.pending[skill] = { assessment_id: row.assessment_id, started_at: row.started_at };
    } else if (row.status === 'failed' || inFlight) {
      result.failed[skill] = { assessment_id: row.assessment_id };
    }
  }

  return result;
}
