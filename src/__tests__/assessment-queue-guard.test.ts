import { describe, it, expect, vi } from 'vitest';
import { hasPendingAssessment, type AssessmentQueueSupabase } from '@/actions/assessment/queue-guard';
import { ASSESSMENT_QUEUE_STALE_MINUTES, assessmentQueueFreshSince } from '@/lib/assessment/queue-freshness';

function buildSupabase(data: Array<{ id: string }> | null, error: { message: string } | null = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }),
  };
  const supabase = { from: vi.fn().mockReturnValue(query) } as unknown as AssessmentQueueSupabase;
  return { supabase, query };
}

describe('hasPendingAssessment', () => {
  it('devuelve true si hay una fila pending o processing', async () => {
    const { supabase } = buildSupabase([{ id: 'queue-1' }]);
    await expect(hasPendingAssessment(supabase, 'user-1', 'speaking')).resolves.toBe(true);
  });

  it('devuelve false si no hay filas', async () => {
    const { supabase } = buildSupabase([]);
    await expect(hasPendingAssessment(supabase, 'user-1', 'speaking')).resolves.toBe(false);
  });

  it('devuelve false si la consulta falla', async () => {
    const { supabase } = buildSupabase(null, { message: 'boom' });
    await expect(hasPendingAssessment(supabase, 'user-1', 'listening')).resolves.toBe(false);
  });

  it('ignora las filas creadas antes de la ventana de caducidad', async () => {
    const { supabase, query } = buildSupabase([]);
    await hasPendingAssessment(supabase, 'user-1', 'writing');
    expect(query.gte).toHaveBeenCalledWith('created_at', expect.any(String));
  });
});

describe('assessmentQueueFreshSince', () => {
  it('resta la ventana de caducidad a la fecha dada', () => {
    const now = new Date('2026-10-22T10:00:00.000Z');
    const expected = new Date(now.getTime() - ASSESSMENT_QUEUE_STALE_MINUTES * 60_000).toISOString();
    expect(assessmentQueueFreshSince(now)).toBe(expected);
  });
});
