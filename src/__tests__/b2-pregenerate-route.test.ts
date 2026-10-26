import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const pregenerateMock = vi.fn();
const adminClient = { from: vi.fn() };

vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdmin: () => adminClient }));
vi.mock('@/lib/pregenerate/b2-content', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/pregenerate/b2-content')>()),
  pregenerate: (...args: unknown[]) => pregenerateMock(...args),
}));
vi.mock('@/lib/cache', () => ({ getCachedContentIfExists: vi.fn(), getOrCreateCachedContent: vi.fn() }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn() }));
vi.mock('@/lib/gemini-client', () => ({ callGemini: vi.fn(), safeParseFallback: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }));
vi.mock('@/lib/session/lifecycle', () => ({ finishSession: vi.fn(), openSession: vi.fn(), recordTurn: vi.fn() }));

import { POST } from '@/app/api/b2/pregenerate/route';
import { selectPregenerateTargets } from '@/lib/pregenerate/b2-content';

const SECRET = 'service-role-secret';

function request(query = '', token: string | null = SECRET): NextRequest {
  return new NextRequest(`http://localhost/api/b2/pregenerate${query}`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('POST /api/b2/pregenerate', () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
    pregenerateMock.mockReset().mockImplementation(async (targets: Array<{ key: string; variant: number }>) =>
      targets.map((target) => ({ key: target.key, variant: target.variant, status: 'generated' })),
    );
  });

  it('rejects a missing token', async () => {
    const res = await POST(request('', null));
    expect(res.status).toBe(401);
    expect(pregenerateMock).not.toHaveBeenCalled();
  });

  it('rejects a wrong token', async () => {
    const res = await POST(request('', 'nope'));
    expect(res.status).toBe(401);
    expect(pregenerateMock).not.toHaveBeenCalled();
  });

  it('rejects any token when the secret is not configured', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await POST(request('', 'undefined'));
    expect(res.status).toBe(401);
  });

  it('rejects invalid parameters', async () => {
    expect((await POST(request('?only=reading'))).status).toBe(400);
    expect((await POST(request('?variant=abc'))).status).toBe(400);
  });

  it('returns the summary for every writing and speaking variant', async () => {
    const res = await POST(request());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.total).toBe(12);
    expect(body.results[0]).toEqual({
      key: 'cambridge_fce_writing_part2_b2_generation',
      variant: 0,
      status: 'generated',
    });
    expect(pregenerateMock.mock.calls[0][1]).toBe(adminClient);
  });

  it('reports ok false when a target fails', async () => {
    pregenerateMock.mockResolvedValue([{ key: 'k', variant: 0, status: 'error' }]);
    const body = await (await POST(request('?only=writing&variant=0'))).json();
    expect(body.ok).toBe(false);
  });
});

describe('selectPregenerateTargets', () => {
  it('selects only writing', () => {
    const targets = selectPregenerateTargets({ only: 'writing' });
    expect(targets).toHaveLength(6);
    expect(targets.every((target) => target.scope === 'writing')).toBe(true);
  });

  it('selects only speaking', () => {
    expect(selectPregenerateTargets({ only: 'speaking' })).toHaveLength(6);
  });

  it('narrows to one config and variant', () => {
    const targets = selectPregenerateTargets({ config: 'cambridge_fce_p3', variant: 2 });
    expect(targets.map((target) => [target.scope, target.variant])).toEqual([['speaking', 2]]);
  });

  it('returns nothing for an unknown config', () => {
    expect(selectPregenerateTargets({ config: 'unknown' })).toEqual([]);
  });
});
