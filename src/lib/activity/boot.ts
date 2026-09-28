export type ActivityBootDecision<T> =
  | { kind: 'restore'; data: T }
  | { kind: 'generate' }
  | { kind: 'restore-failed' };

export interface ResolveActivityBootParams<TMessage, T> {
  initialMessages?: TMessage[];
  sessionId?: string;
  tryRestore: (messages: TMessage[]) => T | null;
}

/**
 * @template TMessage
 * @template T
 * @param params ResolveActivityBootParams
 * @returns ActivityBootDecision
 */
export function resolveActivityBoot<TMessage, T>({
  initialMessages,
  sessionId,
  tryRestore,
}: ResolveActivityBootParams<TMessage, T>): ActivityBootDecision<T> {
  if (initialMessages && initialMessages.length > 0) {
    const restored = tryRestore(initialMessages);
    if (restored) return { kind: 'restore', data: restored };
    return { kind: 'restore-failed' };
  }
  if (sessionId) return { kind: 'restore-failed' };
  return { kind: 'generate' };
}
