import { describe, it, expect } from 'vitest';
import { resolveActivityBoot } from '@/lib/activity/boot';

interface FakeMessage {
  ok: boolean;
}

describe('resolveActivityBoot', () => {
  it('con mensajes restaurables devuelve restore', () => {
    const result = resolveActivityBoot<FakeMessage, { value: number }>({
      initialMessages: [{ ok: true }],
      sessionId: 'session-1',
      tryRestore: (messages) => (messages[0]?.ok ? { value: 42 } : null),
    });
    expect(result).toEqual({ kind: 'restore', data: { value: 42 } });
  });

  it('con mensajes corruptos devuelve restore-failed', () => {
    const result = resolveActivityBoot<FakeMessage, { value: number }>({
      initialMessages: [{ ok: false }],
      sessionId: 'session-1',
      tryRestore: (messages) => (messages[0]?.ok ? { value: 42 } : null),
    });
    expect(result).toEqual({ kind: 'restore-failed' });
  });

  it('sin mensajes y sin sesión devuelve generate', () => {
    const result = resolveActivityBoot<FakeMessage, { value: number }>({
      initialMessages: undefined,
      sessionId: undefined,
      tryRestore: () => null,
    });
    expect(result).toEqual({ kind: 'generate' });
  });

  it('sin mensajes y con sesión devuelve restore-failed', () => {
    const result = resolveActivityBoot<FakeMessage, { value: number }>({
      initialMessages: [],
      sessionId: 'session-1',
      tryRestore: () => null,
    });
    expect(result).toEqual({ kind: 'restore-failed' });
  });
});
