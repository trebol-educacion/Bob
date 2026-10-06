'use client';

import { useCallback, useState } from 'react';
import { submitClosedSetAction, type ClosedSetSubmission } from '@/actions/modes/closed-set';
import type { ClosedEntryResult } from '@/lib/toefl/closed-set';

export interface ClosedSetCallbacks {
  sessionId?: string;
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
}

/**
 * @param callbacks - session id and shell notifications
 * @returns submit handler, last results and the save error
 */
export function useClosedSetSubmit(callbacks: ClosedSetCallbacks) {
  const [sessionId, setSessionId] = useState(callbacks.sessionId);
  const [saved, setSaved] = useState<ClosedEntryResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (submission: Omit<ClosedSetSubmission, 'sessionId'>) => {
      setError(null);
      const outcome = await submitClosedSetAction({ ...submission, sessionId });
      if ('error' in outcome) {
        setError(outcome.error);
        return;
      }
      if (!sessionId) callbacks.onSessionCreated?.(outcome.sessionId);
      setSessionId(outcome.sessionId);
      setSaved(outcome.results);
      callbacks.onSessionFinished?.();
    },
    [sessionId, callbacks],
  );

  return { submit, saved, error };
}
