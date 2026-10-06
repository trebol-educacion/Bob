import { parseInitialTurnStream } from './parse-initial-stream';
import type { PracticeActivityMode, PracticeSeed } from './types';
import type { CefrLevel } from '@/lib/types/practice';

export interface StreamInitialTurnParams {
  mode: PracticeActivityMode;
  seed: PracticeSeed;
  level: CefrLevel;
}

export interface InitialTurnContent {
  framing: string;
  message: string;
}

export type StreamInitialTurnResult =
  | ({ ok: true } & InitialTurnContent)
  | { ok: false; code: string; retryable: boolean; aborted: boolean };

export interface StreamInitialTurnCallbacks {
  signal: AbortSignal;
  onUpdate: (state: InitialTurnContent) => void;
}

async function readErrorCode(response: Response): Promise<{ code: string; retryable: boolean }> {
  try {
    const body = (await response.json()) as { code?: unknown; retryable?: unknown };
    return {
      code: typeof body.code === 'string' ? body.code : `http_${response.status}`,
      retryable: body.retryable === true,
    };
  } catch {
    return { code: `http_${response.status}`, retryable: response.status >= 500 };
  }
}

/**
 * @param params - mode, seed and level of the run
 * @param callbacks - abort signal and progressive update callback
 * @returns the complete opening or an explicit error code; never a placeholder message
 */
export async function streamInitialTurn(
  params: StreamInitialTurnParams,
  { signal, onUpdate }: StreamInitialTurnCallbacks
): Promise<StreamInitialTurnResult> {
  try {
    const response = await fetch('/api/practice/initial-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal,
    });

    if (!response.ok) {
      const { code, retryable } = await readErrorCode(response);
      return { ok: false, code, retryable, aborted: false };
    }
    if (!response.body) return { ok: false, code: 'empty_stream', retryable: true, aborted: false };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let latest = parseInitialTurnStream('');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      latest = parseInitialTurnStream(buffer);
      onUpdate({ framing: latest.framing, message: latest.message });
    }

    if (!latest.message.trim()) return { ok: false, code: 'empty_opening', retryable: true, aborted: false };
    return { ok: true, framing: latest.framing, message: latest.message };
  } catch (error) {
    if (signal.aborted) return { ok: false, code: 'aborted', retryable: false, aborted: true };
    console.error('[streamInitialTurn] failed:', error);
    return { ok: false, code: 'stream_failed', retryable: true, aborted: false };
  }
}
