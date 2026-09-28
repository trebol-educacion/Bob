import { parseInitialTurnStream } from './parse-initial-stream';
import type { PracticeActivityMode, PracticeSeed } from './types';
import type { CefrLevel } from '@/lib/types/practice';

export interface StreamInitialTurnParams {
  mode: PracticeActivityMode;
  seed: PracticeSeed;
  level: CefrLevel;
}

export interface StreamInitialTurnResult {
  framing: string;
  message: string;
}

export interface StreamInitialTurnCallbacks {
  signal: AbortSignal;
  onUpdate: (state: StreamInitialTurnResult) => void;
}

const FALLBACK_MESSAGE = "Hello! I'm ready to start when you are.";

/**
 * @param params StreamInitialTurnParams
 * @param callbacks StreamInitialTurnCallbacks
 * @returns StreamInitialTurnResult
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

    if (!response.ok || !response.body) return { framing: '', message: FALLBACK_MESSAGE };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let latest = { framing: '', message: '', messageComplete: false };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      latest = parseInitialTurnStream(buffer);
      onUpdate({ framing: latest.framing, message: latest.message });
    }

    if (!latest.message) return { framing: latest.framing, message: FALLBACK_MESSAGE };
    return { framing: latest.framing, message: latest.message };
  } catch (error) {
    if (signal.aborted) return { framing: '', message: '' };
    console.error('[streamInitialTurn] failed:', error);
    return { framing: '', message: FALLBACK_MESSAGE };
  }
}
