import { describe, it, expect } from 'vitest';
import {
  deriveAssessmentQueueStatus,
  emptyAssessmentQueueStatus,
  type AssessmentQueueRow,
} from '@/lib/assessment/queue-status';
import { ASSESSMENT_QUEUE_STALE_MINUTES } from '@/lib/assessment/queue-freshness';

const NOW = new Date('2026-10-26T12:00:00.000Z');

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

function row(partial: Partial<AssessmentQueueRow> & Pick<AssessmentQueueRow, 'status' | 'created_at'>): AssessmentQueueRow {
  return { skill: 'speaking', assessment_id: 'a-1', started_at: null, ...partial };
}

describe('deriveAssessmentQueueStatus', () => {
  it('devuelve vacío sin filas', () => {
    expect(deriveAssessmentQueueStatus([], NOW)).toEqual(emptyAssessmentQueueStatus());
  });

  it('pending reciente cuenta como pending', () => {
    const result = deriveAssessmentQueueStatus([row({ status: 'pending', created_at: minutesAgo(2) })], NOW);
    expect(result.pending.speaking).toEqual({ assessment_id: 'a-1', started_at: null });
    expect(result.failed.speaking).toBeNull();
  });

  it('processing reciente conserva started_at', () => {
    const startedAt = minutesAgo(1);
    const result = deriveAssessmentQueueStatus(
      [row({ skill: 'writing', status: 'processing', started_at: startedAt, created_at: minutesAgo(3) })],
      NOW,
    );
    expect(result.pending.writing).toEqual({ assessment_id: 'a-1', started_at: startedAt });
  });

  it('failed cuenta como failed', () => {
    const result = deriveAssessmentQueueStatus([row({ status: 'failed', created_at: minutesAgo(5) })], NOW);
    expect(result.failed.speaking).toEqual({ assessment_id: 'a-1' });
    expect(result.pending.speaking).toBeNull();
  });

  it('processing caducado cuenta como failed', () => {
    const result = deriveAssessmentQueueStatus(
      [row({ status: 'processing', created_at: minutesAgo(ASSESSMENT_QUEUE_STALE_MINUTES + 1) })],
      NOW,
    );
    expect(result.failed.speaking).toEqual({ assessment_id: 'a-1' });
    expect(result.pending.speaking).toBeNull();
  });

  it('pending caducado cuenta como failed', () => {
    const result = deriveAssessmentQueueStatus(
      [row({ status: 'pending', created_at: minutesAgo(ASSESSMENT_QUEUE_STALE_MINUTES * 4) })],
      NOW,
    );
    expect(result.failed.speaking).toEqual({ assessment_id: 'a-1' });
  });

  it('done posterior a failed no deja estado', () => {
    const result = deriveAssessmentQueueStatus(
      [
        row({ assessment_id: 'a-old', status: 'failed', created_at: minutesAgo(60) }),
        row({ assessment_id: 'a-new', status: 'done', created_at: minutesAgo(10) }),
      ],
      NOW,
    );
    expect(result).toEqual(emptyAssessmentQueueStatus());
  });

  it('superseded no deja estado', () => {
    const result = deriveAssessmentQueueStatus([row({ status: 'superseded', created_at: minutesAgo(1) })], NOW);
    expect(result).toEqual(emptyAssessmentQueueStatus());
  });

  it('la fila más reciente gana sin depender del orden de entrada', () => {
    const result = deriveAssessmentQueueStatus(
      [
        row({ assessment_id: 'a-new', status: 'pending', created_at: minutesAgo(1) }),
        row({ assessment_id: 'a-old', status: 'failed', created_at: minutesAgo(30) }),
      ].reverse(),
      NOW,
    );
    expect(result.pending.speaking).toEqual({ assessment_id: 'a-new', started_at: null });
    expect(result.failed.speaking).toBeNull();
  });

  it('separa el estado por destreza', () => {
    const result = deriveAssessmentQueueStatus(
      [
        row({ skill: 'speaking', assessment_id: 's-1', status: 'failed', created_at: minutesAgo(20) }),
        row({ skill: 'writing', assessment_id: 'w-1', status: 'pending', created_at: minutesAgo(2) }),
      ],
      NOW,
    );
    expect(result.failed).toEqual({ speaking: { assessment_id: 's-1' }, listening: null, reading: null, writing: null });
    expect(result.pending).toEqual({
      speaking: null, listening: null, reading: null, writing: { assessment_id: 'w-1', started_at: null },
    });
  });

  it('ignora destrezas desconocidas', () => {
    const result = deriveAssessmentQueueStatus([row({ skill: 'math', status: 'failed', created_at: minutesAgo(1) })], NOW);
    expect(result).toEqual(emptyAssessmentQueueStatus());
  });
});
