// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/actions/gemini', () => ({
  chatConversationAction: vi.fn(),
  chatTextConversationAction: vi.fn(),
  simulateUserResponseAction: vi.fn(),
  generateSpeechAction: vi.fn(),
}));

vi.mock('@/actions/practice/repository', () => ({
  addPracticeTurnAction: vi.fn().mockResolvedValue({ ok: true, data: null }),
  updatePracticeModeAction: vi.fn().mockResolvedValue({ ok: true, data: null }),
}));

vi.mock('@/actions/practice/turn', () => ({
  generatePracticeInitialTurnAction: vi.fn(),
}));

vi.mock('@/actions/practice/image', () => ({
  generatePracticeImageAction: vi.fn().mockResolvedValue({ ok: false, imageUrl: null }),
}));

import { chatTextConversationAction, generateSpeechAction } from '@/actions/gemini';
import { usePracticeTurn } from '@/hooks/practice/usePracticeTurn';

const SEED = { angle: 'a', character: 'a friend', tone: 'warm', topic: 'a warm chat' };

function baseArgs() {
  return {
    sessionId: 'session-1',
    mode: 'conversation' as const,
    seed: SEED,
    level: 'b1' as const,
    initialFraming: 'framing',
    initialMessage: 'Hello!',
  };
}

describe('usePracticeTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('el turno adelantado: el audio del primer turno de Bob se prepara solo, sin que el alumno pulse Listen', async () => {
    (generateSpeechAction as ReturnType<typeof vi.fn>).mockResolvedValue({ data: 'AAAA', mimeType: 'audio/L16;rate=24000' });

    renderHook(() => usePracticeTurn(baseArgs()));

    await waitFor(() => {
      expect(generateSpeechAction).toHaveBeenCalledWith('Hello!');
    });
  });

  it('turno que llega tarde: handleListen espera con isGeneratingAudio en vez de quedar en blanco', async () => {
    let resolveSpeech: (v: { data: string; mimeType: string }) => void = () => {};
    (generateSpeechAction as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => { resolveSpeech = resolve; })
    );

    const { result } = renderHook(() => usePracticeTurn(baseArgs()));

    let listenPromise: Promise<void> = Promise.resolve();
    act(() => {
      listenPromise = result.current.handleListen(0);
    });

    await waitFor(() => expect(result.current.isGeneratingAudio).toBe(0));

    resolveSpeech({ data: 'AAAA', mimeType: 'audio/L16;rate=24000' });
    await act(async () => {
      await listenPromise;
    });

    expect(result.current.isGeneratingAudio).toBeNull();
    expect(result.current.playCounts[0]).toBe(1);
  });

  it('un turno de texto registra la señal de rubrica y persiste sin bloquear', async () => {
    (generateSpeechAction as ReturnType<typeof vi.fn>).mockResolvedValue({ data: '', mimeType: 'audio/L16;rate=24000' });
    (chatTextConversationAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      evaluation: { score: 80, feedback: 'good', transcribed_text: 'hi' },
      ai_response: 'Nice to meet you!',
    });

    const { result } = renderHook(() => usePracticeTurn(baseArgs()));

    act(() => {
      result.current.setInputText('hi there');
    });

    await act(async () => {
      await result.current.handleSendText();
    });

    expect(result.current.turnSignals).toHaveLength(1);
    expect(result.current.turnSignals[0]).toMatchObject({ hasAudio: false, turnScore: 80 });
    expect(result.current.messages).toHaveLength(3);
  });
});
