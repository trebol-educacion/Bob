import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseInitialTurnStream } from '@/lib/practice/parse-initial-stream';
import { streamInitialTurn } from '@/lib/practice/stream-initial-turn';
import { PRACTICE_FALLBACK_PROMPTS } from '@/lib/prompts/fallback-prompts-practice';
import { FALLBACK_PROMPTS } from '@/lib/prompts/fallback-prompts';
import streams from './fixtures/practice-initial-streams.json';

function replay(chunks: string[]): { state: ReturnType<typeof parseInitialTurnStream>; partials: string[] } {
  let buffer = '';
  const partials: string[] = [];
  let state = parseInitialTurnStream('');
  for (const chunk of chunks) {
    buffer += chunk;
    state = parseInitialTurnStream(buffer);
    partials.push(state.message);
  }
  return { state, partials };
}

describe('parser del turno inicial con streams reales grabados de Gemini', () => {
  it('contrato antiguo first_message (con fence de markdown): el primer mensaje ya no sale vacio', () => {
    const { state } = replay(streams.legacyFirstMessageB2);
    expect(state.message.length).toBeGreaterThan(10);
    expect(state.message).toMatch(/^Hey there/);
    expect(state.framing.length).toBeGreaterThan(10);
  });

  it('contrato message: encuadre y mensaje llegan completos y el mensaje crece de forma progresiva', () => {
    const { state, partials } = replay(streams.framingEnglishB2);
    expect(state.messageComplete).toBe(true);
    expect(state.message.length).toBeGreaterThan(10);
    expect(new Set(partials.filter(Boolean)).size).toBeGreaterThanOrEqual(1);
  });

  it('el encuadre grabado para B2 esta en ingles y el de A2 en espanol', () => {
    const b2 = replay(streams.framingEnglishB2).state.framing;
    const a2 = replay(streams.framingSpanishA2).state.framing;
    expect(b2).toMatch(/\b(the|and|you)\b/i);
    expect(b2).not.toMatch(/[áéíóúñ¿¡]/);
    expect(a2).toMatch(/[áéíóúñ]| con | un /i);
  });
});

describe('streamInitialTurn: errores explicitos, nunca un mensaje de relleno', () => {
  const params = { mode: 'conversation' as const, seed: { angle: 'a', character: 'c', tone: 't', topic: 'x' }, level: 'b2' as const };
  const callbacks = () => ({ signal: new AbortController().signal, onUpdate: vi.fn() });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('un 502 con codigo del servidor se devuelve como error con ese codigo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ code: 'rate_limited', retryable: true }, { status: 502 })));
    expect(await streamInitialTurn(params, callbacks())).toEqual({ ok: false, code: 'rate_limited', retryable: true, aborted: false });
  });

  it('un 200 sin mensaje es empty_opening y no el texto de relleno', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"framing":"hola"}', { status: 200 })));
    expect(await streamInitialTurn(params, callbacks())).toMatchObject({ ok: false, code: 'empty_opening' });
  });

  it('un stream real completo devuelve encuadre y mensaje', async () => {
    const body = streams.framingEnglishB2.join('');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const result = await streamInitialTurn(params, callbacks());
    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.message.length).toBeGreaterThan(10);
  });
});

describe('prompts de practica: encuadre en espanol solo hasta A2', () => {
  const keys = ['generic_conversation_shared_initial', 'practice_situation_shared_initial', 'practice_picture_shared_initial'];
  const all: Record<string, string> = { ...FALLBACK_PROMPTS, ...PRACTICE_FALLBACK_PROMPTS };

  it.each(keys)('%s recibe CEFR_LEVEL y condiciona el idioma del encuadre al nivel', (key) => {
    const prompt = all[key];
    expect(prompt).toContain('{CEFR_LEVEL}');
    expect(prompt).toContain('in Spanish when the CEFR level is pre_a1, a1 or a2');
    expect(prompt).toContain('in English, with simple words, when the CEFR level is b1, b2, c1 or c2');
    expect(prompt).toContain('"message"');
    expect(prompt).not.toContain('first_message');
  });
});
