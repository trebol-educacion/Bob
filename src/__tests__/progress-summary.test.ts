vi.mock('server-only', () => ({}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapProgressSummary, emptyStudentStats } from '@/lib/stats/progress-summary';
import { nextLevelLabel } from '@/lib/stats/derive';

const rpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(async () => ({ rpc })),
}));

const RAW = {
  total_sessions: 3,
  global_avg: '6.5',
  streak: 2,
  total_stars: 4,
  periods: { week: 2, month: 3, year: 3, total: 3 },
  session_dates: ['2026-10-06T10:00:00Z', '2026-10-05T10:00:00Z'],
  by_mode: [{ mode: 'cambridge_fce_p1', sessions_count: 2, avg_score: 7, last_done: '2026-10-06T10:00:00Z' }],
  activities: [{ mode: 'cambridge_fce_p1', score10: null, created_at: '2026-10-06T10:00:00Z' }],
  targets: [{ skill: 'reading', cefr_level: 'b2', target_count: 12 }],
  last_tests: [{ skill: 'speaking', cefr_band: 'b2', occurred_at: '2026-09-01T00:00:00Z' }, { skill: 'bogus', cefr_band: 'x', occurred_at: 'y' }],
};

describe('mapProgressSummary', () => {
  it('maps the bob.progress_summary payload to StudentStatsResult', () => {
    const r = mapProgressSummary(RAW);
    expect(r.total_sessions).toBe(3);
    expect(r.global_avg).toBe(6.5);
    expect(r.streak).toBe(2);
    expect(r.total_stars).toBe(4);
    expect(r.periods).toEqual({ week: 2, month: 3, year: 3, total: 3 });
    expect(r.rows).toEqual([{ mode: 'cambridge_fce_p1', sessions_count: 2, avg_score: 7, score_max: 10, last_done: '2026-10-06T10:00:00Z' }]);
    expect(r.activities[0].score10).toBeNull();
    expect(r.targets).toEqual({ reading: { b2: 12 } });
    expect(r.last_tests.speaking).toEqual({ cefr_band: 'b2', occurred_at: '2026-09-01T00:00:00Z' });
    expect(r.last_tests.reading).toBeNull();
    expect(r.session_dates).toHaveLength(2);
  });

  it('returns the empty shape for null or malformed payloads', () => {
    expect(mapProgressSummary(null)).toEqual(emptyStudentStats());
    expect(mapProgressSummary('x')).toEqual(emptyStudentStats());
  });
});

describe('nextLevelLabel', () => {
  it('returns the following level and null at the top', () => {
    expect(nextLevelLabel('b1')).toBe('B2');
    expect(nextLevelLabel('b2')).toBeNull();
  });
});

describe('getStudentStatsAction', () => {
  beforeEach(() => rpc.mockReset());

  it('uses one progress_summary call and forwards the optional period', async () => {
    rpc.mockResolvedValue({ data: RAW, error: null });
    const { getStudentStatsAction } = await import('@/actions/stats');
    const r = await getStudentStatsAction({ from: '2026-09-01', to: '2026-09-30' });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('progress_summary', { p_from: '2026-09-01', p_to: '2026-09-30' });
    expect(r.total_sessions).toBe(3);
  });

  it('degrades to the empty shape when the rpc fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { getStudentStatsAction } = await import('@/actions/stats');
    expect(await getStudentStatsAction()).toEqual(emptyStudentStats());
  });
});
