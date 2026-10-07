// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('@/actions/practice/start', () => ({ preparePracticeAction: vi.fn() }));
vi.mock('@/actions/practice/resume', () => ({ getPracticeResumeAction: vi.fn() }));
vi.mock('@/lib/practice/stream-initial-turn', () => ({ streamInitialTurn: vi.fn() }));

import { preparePracticeAction } from '@/actions/practice/start';
import { getPracticeResumeAction } from '@/actions/practice/resume';
import { streamInitialTurn } from '@/lib/practice/stream-initial-turn';
import { usePracticeBoot } from '@/hooks/practice/usePracticeBoot';
import { buildExchangeMessages, buildOpeningMessages } from '@/lib/practice/messages';

const SEED = { angle: 'a', character: 'a friend', tone: 'warm', topic: 'server topic' };
const SIGNAL = { hasAudio: false, hintUsed: false, modelAnswerUsed: false, turnScore: 70 };

const args = { mode: 'conversation' as const, cefrActiveLevel: null, skillLevels: null };

beforeEach(() => {
  vi.resetAllMocks();
  (preparePracticeAction as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, data: { mode: 'conversation', level: 'b2', seed: SEED } });
});

describe('usePracticeBoot', () => {
  it('usa la seed y el nivel que elige el servidor y los pasa al stream, sin sortear nada en cliente', async () => {
    (streamInitialTurn as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, framing: 'F', message: 'Hello' });

    const { result } = renderHook(() => usePracticeBoot(args));

    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(streamInitialTurn).toHaveBeenCalledWith({ mode: 'conversation', seed: SEED, level: 'b2' }, expect.anything());
    expect(result.current).toMatchObject({ seed: SEED, level: 'b2', sessionId: null, messages: [{ role: 'model', text: 'Hello' }] });
  });

  it('un fallo del stream deja el estado en error con su codigo y reintento, no un mensaje de relleno', async () => {
    (streamInitialTurn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, code: 'rate_limited', retryable: true, aborted: false });

    const { result } = renderHook(() => usePracticeBoot(args));

    await waitFor(() => expect(result.current.phase).toBe('error'));
    expect(result.current).toMatchObject({ code: 'rate_limited', retryable: true });

    (streamInitialTurn as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, framing: 'F', message: 'Hello again' });
    act(() => result.current.restart());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(preparePracticeAction).toHaveBeenCalledTimes(2);
  });

  it('reabrir una sesion restaura conversacion y seed guardada sin pedir otra apertura a Gemini', async () => {
    const stored = [
      ...buildOpeningMessages({ framing: 'F', message: 'Hello', imageUrl: null, imagePrompt: null }),
      ...buildExchangeMessages({ text: 'Hi Bob', signal: SIGNAL }, 'Nice'),
    ].map((m) => ({ role: m.role, msg_type: m.msgType, content_text: m.contentText ?? null, content_json: (m.contentJson as Record<string, unknown>) ?? null }));
    (getPracticeResumeAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { mode: 'situation', level: 'a2', seed: SEED, finished: false },
    });

    const { result } = renderHook(() => usePracticeBoot({ ...args, resume: { sessionId: 's1', messages: stored } }));

    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(streamInitialTurn).not.toHaveBeenCalled();
    expect(preparePracticeAction).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ sessionId: 's1', mode: 'situation', level: 'a2', framing: 'F' });
    expect((result.current as { messages: unknown[] }).messages).toHaveLength(3);
  });
});
