// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/actions/gemini', () => ({
  chatConversationAction: vi.fn(),
  chatTextConversationAction: vi.fn(),
  suggestStudentAnswerAction: vi.fn(),
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

import { chatTextConversationAction, generateSpeechAction, suggestStudentAnswerAction } from '@/actions/gemini';
import { generatePracticeImageAction } from '@/actions/practice/image';
import { usePracticeTurn } from '@/hooks/practice/usePracticeTurn';

const SEED = { angle: 'a', character: 'a friend', tone: 'warm', topic: 'a warm chat' };

function baseArgs() {
  return {
    sessionId: 'session-1',
    mode: 'conversation' as const,
    seed: SEED,
    level: 'b1' as const,
    initialFraming: 'framing',
    initialMessages: [{ role: 'model' as const, text: 'Hello!' }],
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

  it('Show me an answer: pide una respuesta modelo ya interpretada, nunca JSON crudo, y marca el turno como asistido', async () => {
    (generateSpeechAction as ReturnType<typeof vi.fn>).mockResolvedValue({ data: '', mimeType: 'audio/L16;rate=24000' });
    (suggestStudentAnswerAction as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, answer: "You're very welcome!" });
    (chatTextConversationAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      evaluation: { score: 90, feedback: 'good', transcribed_text: "You're very welcome!" },
      ai_response: 'Glad to hear it!',
    });

    const { result } = renderHook(() => usePracticeTurn(baseArgs()));

    await act(async () => {
      await result.current.handleRequestModelAnswer();
    });

    expect(suggestStudentAnswerAction).toHaveBeenCalledWith(baseArgs().initialMessages, SEED.topic, 'b1');
    expect(result.current.pendingModelAnswer).toBe("You're very welcome!");

    act(() => {
      result.current.setInputText("You're very welcome!");
    });
    await act(async () => {
      await result.current.handleSendText();
    });

    expect(result.current.turnSignals[0]).toMatchObject({ modelAnswerUsed: true });
    expect(result.current.pendingModelAnswer).toBeNull();
  });

  it('modo conversacion: el turno nuevo de Bob se escucha solo tras un breve retardo, y si el audio falla el texto se revela', async () => {
    vi.useFakeTimers();
    try {
      (generateSpeechAction as ReturnType<typeof vi.fn>).mockResolvedValue({ data: 'AAAA', mimeType: 'audio/L16;rate=24000' });
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

      const newModelIndex = result.current.messages.length - 1;
      expect(result.current.playCounts[newModelIndex]).toBeUndefined();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.playCounts[newModelIndex]).toBe(1);
      expect(result.current.visibleTexts[newModelIndex]).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('el mensaje inicial de una sesion retomada no se reproduce solo (solo autoplay para turnos nuevos)', async () => {
    vi.useFakeTimers();
    try {
      (generateSpeechAction as ReturnType<typeof vi.fn>).mockResolvedValue({ data: 'AAAA', mimeType: 'audio/L16;rate=24000' });

      const { result } = renderHook(() => usePracticeTurn(baseArgs()));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(result.current.playCounts[0]).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('modos situation y picture no reproducen el turno de Bob solos (sin escucha primero)', async () => {
    vi.useFakeTimers();
    try {
      (generateSpeechAction as ReturnType<typeof vi.fn>).mockResolvedValue({ data: 'AAAA', mimeType: 'audio/L16;rate=24000' });
      (chatTextConversationAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        evaluation: { score: 80, feedback: 'good', transcribed_text: 'hi' },
        ai_response: 'Sure, go on.',
      });

      const { result } = renderHook(() => usePracticeTurn({ ...baseArgs(), mode: 'situation' }));

      act(() => {
        result.current.setInputText('hi there');
      });
      await act(async () => {
        await result.current.handleSendText();
      });

      const newModelIndex = result.current.messages.length - 1;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(result.current.playCounts[newModelIndex]).toBeUndefined();
      expect(result.current.visibleTexts[newModelIndex]).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('modo picture sin sessionId (repositorio degradado) igual pide la imagen, no se queda mudo', async () => {
    (generateSpeechAction as ReturnType<typeof vi.fn>).mockResolvedValue({ data: '', mimeType: 'audio/L16;rate=24000' });
    (generatePracticeImageAction as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, imageUrl: 'data:image/png;base64,AAAA' });

    const { result } = renderHook(() => usePracticeTurn({ ...baseArgs(), sessionId: null, mode: 'picture' }));

    await waitFor(() => {
      expect(generatePracticeImageAction).toHaveBeenCalledWith(null, SEED.topic);
    });
    await waitFor(() => {
      expect(result.current.imageUrl).toBe('data:image/png;base64,AAAA');
    });
  });
});
