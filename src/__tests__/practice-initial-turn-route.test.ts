import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const getUserMock = vi.fn();
const getPromptMock = vi.fn();
const streamGeminiMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({ auth: { getUser: () => getUserMock() } }),
}));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: (...a: unknown[]) => getPromptMock(...a) }));
vi.mock('@/lib/gemini-client', () => ({ streamGemini: (...a: unknown[]) => streamGeminiMock(...a) }));

import { POST } from '@/app/api/practice/initial-turn/route';
import type { NextRequest } from 'next/server';

const SEED = { angle: 'a', character: 'a friend', tone: 'warm', topic: 'a warm chat' };

function request(body: unknown): NextRequest {
  return new Request('http://localhost/api/practice/initial-turn', { method: 'POST', body: JSON.stringify(body) }) as unknown as NextRequest;
}

async function* chunks(parts: string[]) {
  for (const text of parts) yield { text };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
  getPromptMock.mockResolvedValue('prompt');
});

describe('POST /api/practice/initial-turn', () => {
  it.each(['a2', 'b2'] as const)('pasa el nivel efectivo %s al prompt como CEFR_LEVEL', async (level) => {
    streamGeminiMock.mockResolvedValue({ ok: true, stream: chunks(['{"framing":"f","message":"m"}']) });

    const response = await POST(request({ mode: 'conversation', seed: SEED, level }));

    expect(response.status).toBe(200);
    expect(getPromptMock).toHaveBeenCalledWith('generic_conversation_shared_initial', expect.objectContaining({ CEFR_LEVEL: level, TOPIC: 'a warm chat' }));
    expect(await response.text()).toBe('{"framing":"f","message":"m"}');
  });

  it('si Gemini falla al abrir el stream devuelve 502 con codigo, no un 200 vacio', async () => {
    streamGeminiMock.mockResolvedValue({ ok: false, error: 'boom', retryable: true, code: 'rate_limited' });

    const response = await POST(request({ mode: 'situation', seed: SEED, level: 'b1' }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: 'rate_limited', retryable: true });
  });

  it('si getPrompt lanza devuelve 503 prompt_unavailable', async () => {
    getPromptMock.mockRejectedValue(new Error('db down'));

    const response = await POST(request({ mode: 'picture', seed: SEED, level: 'b1' }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: 'prompt_unavailable', retryable: true });
  });

  it('rechaza niveles y modos invalidos con 400 y sin usuario con 401', async () => {
    expect((await POST(request({ mode: 'conversation', seed: SEED, level: 'z9' }))).status).toBe(400);
    expect((await POST(request({ mode: 'nope', seed: SEED, level: 'b1' }))).status).toBe(400);
    getUserMock.mockResolvedValue({ data: { user: null } });
    expect((await POST(request({ mode: 'conversation', seed: SEED, level: 'b1' }))).status).toBe(401);
  });
});
