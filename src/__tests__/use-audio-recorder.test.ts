// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

class FakeMediaRecorder {
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(['a'.repeat(1024)], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

describe('useAudioRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder as unknown as typeof MediaRecorder);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('estado grabando: isRecording se activa y el tiempo transcurrido avanza cada segundo', async () => {
    const { result } = renderHook(() => useAudioRecorder({ onRecorded: vi.fn() }));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(result.current.elapsedSeconds).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(result.current.elapsedSeconds).toBe(3);
  });

  it('al parar, isRecording se apaga y el tiempo transcurrido vuelve a cero', async () => {
    const onRecorded = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onRecorded }));

    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.elapsedSeconds).toBe(0);
    expect(onRecorded).toHaveBeenCalledTimes(1);
  });
});
