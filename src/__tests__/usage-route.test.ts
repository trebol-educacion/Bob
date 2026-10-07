import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(async () => ({ rpc })),
}));

import { POST } from '@/app/api/usage/route';

function req(body: unknown): Request {
  return new Request('http://localhost/api/usage', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
}

describe('POST /api/usage', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ error: null });
  });

  it('calls track_usage with inferred skill and clamped seconds', async () => {
    const res = await POST(req({ mode: 'cambridge_fce_reading_part1', seconds: 9999 }));
    expect(res.status).toBe(204);
    expect(rpc).toHaveBeenCalledWith('track_usage', expect.objectContaining({
      p_mode: 'cambridge_fce_reading_part1',
      p_skill: 'reading',
      p_seconds: 150,
    }));
  });

  it('rejects malformed payloads without touching the database', async () => {
    expect((await POST(req('not json'))).status).toBe(400);
    expect((await POST(req({ mode: '', seconds: 10 }))).status).toBe(400);
    expect((await POST(req({ mode: 'x', seconds: 'a' }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('skips the database for zero seconds', async () => {
    expect((await POST(req({ mode: 'x', seconds: 0 }))).status).toBe(204);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('answers 401 when the session is missing', async () => {
    rpc.mockResolvedValue({ error: { message: 'not authenticated' } });
    expect((await POST(req({ mode: 'x', seconds: 10 }))).status).toBe(401);
  });
});
