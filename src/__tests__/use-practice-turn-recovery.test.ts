// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/actions/gemini', () => ({
  chatConversationAction: vi.fn(),
  chatTextConversationAction: vi.fn(),
  suggestStudentAnswerAction: vi.fn(),
  generateSpeechAction: vi.fn(),
}));

vi.mock('@/actions/practice/turn', () => ({
  recordPracticeTurnAction: vi.fn().mockResolvedValue({ ok: true, data: { sessionId: 'session-1' } }),
}));

vi.mock('@/actions/practice/image', () => ({
  generatePracticeImageAction: vi.fn().mockResolvedValue({ ok: false, imageUrl: null, prompt: null }),
}));

vi.mock('@/lib/audio', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audio')>();
  return {
    ...actual,
    blobToBase64: vi.fn().mockResolvedValue('base64-audio'),
  };
});

import { chatConversationAction, chatTextConversationAction, generateSpeechAction } from '@/actions/gemini';
import { usePracticeTurn } from '@/hooks/practice/usePracticeTurn';

const SEED = { angle: 'a', character: 'a friend', tone: 'warm', topic: 'a warm chat' };

type ChatResult = { ai_response: string; evaluation: { score: number; feedback: string; transcribed_text: string } };

function baseArgs() {
  return {
    sessionId: 'session-1',
    organizationId: 'org-1',
    mode: 'conversation' as const,
    seed: SEED,
    level: 'b1' as const,
    initialFraming: 'framing',
    initialMessages: [{ role: 'model' as const, text: 'Hello!' }],
  };
}

describe('usePracticeTurn · recuperacion visible del turno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('al soltar el micro aparece de inmediato la burbuja de procesando y el indicador de que Bob esta pensando', async () => {
    let resolveChat: (v: ChatResult) => void = () => {};
    (generateSpeechAction as ReturnType<typeof vi.fn>).mockResolvedValue({ data: '', mimeType: 'audio/L16;rate=24000' });
    (chatConversationAction as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => { resolveChat = resolve; })
    );

    const { result } = renderHook(() => usePracticeTurn(baseArgs()));

    let sendPromise: Promise<void> = Promise.resolve();
    act(() => {
      sendPromise = result.current.handleSendAudio(new Blob(['audio'], { type: 'audio/webm' }));
    });

    await waitFor(() => expect(result.current.isProcessing).toBe(true));
    expect(result.current.pendingTurn).toEqual({ text: null });

    resolveChat({
      ai_response: 'Nice one!',
      evaluation: { score: 70, feedback: 'ok', transcribed_text: 'hello there' },
    });
    await act(async () => {
      await sendPromise;
    });

    expect(result.current.pendingTurn).toBeNull();
    expect(result.current.isProcessing).toBe(false);
  });

  it('el microfono queda bloqueado mientras hay un turno en curso: una segunda llamada no dispara una segunda peticion', async () => {
    let resolveChat: (v: ChatResult) => void = () => {};
    (generateSpeechAction as ReturnType<typeof vi.fn>).mockResolvedValue({ data: '', mimeType: 'audio/L16;rate=24000' });
    (chatConversationAction as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => { resolveChat = resolve; })
    );

    const { result } = renderHook(() => usePracticeTurn(baseArgs()));

    act(() => {
      void result.current.handleSendAudio(new Blob(['audio'], { type: 'audio/webm' }));
    });
    await waitFor(() => expect(result.current.isProcessing).toBe(true));

    await act(async () => {
      await result.current.handleSendAudio(new Blob(['audio-2'], { type: 'audio/webm' }));
    });

    await waitFor(() => expect(chatConversationAction).toHaveBeenCalledTimes(1));

    resolveChat({
      ai_response: 'Nice one!',
      evaluation: { score: 70, feedback: 'ok', transcribed_text: 'hello there' },
    });
    await waitFor(() => expect(result.current.isProcessing).toBe(false));
  });

  it('si la peticion tarda mucho, un aviso honesto de que sigue en marcha aparece sin quedarse en silencio', async () => {
    vi.useFakeTimers();
    try {
      let resolveChat: (v: ChatResult) => void = () => {};
      (generateSpeechAction as ReturnType<typeof vi.fn>).mockResolvedValue({ data: '', mimeType: 'audio/L16;rate=24000' });
      (chatTextConversationAction as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => { resolveChat = resolve; })
      );

      const { result } = renderHook(() => usePracticeTurn(baseArgs()));

      act(() => {
        result.current.setInputText('hi there');
      });

      let sendPromise: Promise<void> = Promise.resolve();
      act(() => {
        sendPromise = result.current.handleSendText();
      });

      expect(result.current.isSlow).toBe(false);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(result.current.isSlow).toBe(true);

      resolveChat({
        ai_response: 'Nice one!',
        evaluation: { score: 70, feedback: 'ok', transcribed_text: 'hi there' },
      });
      await act(async () => {
        await sendPromise;
      });

      expect(result.current.isSlow).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fallo al enviar: el error sale en linea con reintento y el reintento reenvia el mismo turno sin perderlo', async () => {
    (generateSpeechAction as ReturnType<typeof vi.fn>).mockResolvedValue({ data: '', mimeType: 'audio/L16;rate=24000' });
    (chatTextConversationAction as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        ai_response: 'Nice one!',
        evaluation: { score: 70, feedback: 'ok', transcribed_text: 'hi there' },
      });

    const { result } = renderHook(() => usePracticeTurn(baseArgs()));

    act(() => {
      result.current.setInputText('hi there');
    });
    await act(async () => {
      await result.current.handleSendText();
    });

    expect(result.current.errorMessage).toBe('sendMessageError');
    expect(result.current.canRetry).toBe(true);
    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.retryLastTurn();
    });

    await waitFor(() => expect(result.current.errorMessage).toBeNull());
    await waitFor(() => expect(result.current.messages).toHaveLength(3));
    expect(chatTextConversationAction).toHaveBeenCalledTimes(2);
    expect(result.current.canRetry).toBe(false);
  });

  it('si generar el audio se agota el plazo, el texto se revela y el rechazo no escapa del flujo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      (generateSpeechAction as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => usePracticeTurn(baseArgs()));

      let listenPromise: Promise<void> = Promise.resolve();
      act(() => {
        listenPromise = result.current.handleListen(0);
      });

      await waitFor(() => expect(result.current.isGeneratingAudio).toBe(0));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15000);
        await listenPromise;
      });

      expect(result.current.visibleTexts[0]).toBe(true);
      expect(result.current.isGeneratingAudio).toBeNull();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
