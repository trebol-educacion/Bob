import { describe, it, expect, vi } from 'vitest';
import { hasPendingAssessment, type AssessmentQueueSupabase } from '@/actions/assessment/queue-guard';

function buildSupabase(data: Array<{ id: string }> | null, error: { message: string } | null = null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data, error }),
    }),
  } as unknown as AssessmentQueueSupabase;
}

describe('hasPendingAssessment', () => {
  it('devuelve true si hay una fila pending o processing', async () => {
    const supabase = buildSupabase([{ id: 'queue-1' }]);
    await expect(hasPendingAssessment(supabase, 'user-1', 'speaking')).resolves.toBe(true);
  });

  it('devuelve false si no hay filas', async () => {
    const supabase = buildSupabase([]);
    await expect(hasPendingAssessment(supabase, 'user-1', 'speaking')).resolves.toBe(false);
  });

  it('devuelve false si la consulta falla', async () => {
    const supabase = buildSupabase(null, { message: 'boom' });
    await expect(hasPendingAssessment(supabase, 'user-1', 'listening')).resolves.toBe(false);
  });
});
