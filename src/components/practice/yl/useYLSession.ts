import { useCallback, useRef, useState } from 'react';
import { openYLSessionAction, saveYLFinalEvalAction } from '@/actions/modes/yl';
import type { YLPlan } from '@/lib/types/yl';
import type { EvalResponse, ModeKey } from '@/lib/types/practice';

export interface UseYLSessionParams {
  mode: ModeKey;
  initialSessionId?: string;
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
}

export interface UseYLSessionReturn {
  sessionId: string | undefined;
  stash: (plan: YLPlan, images?: string[]) => void;
  open: () => Promise<string | null>;
  finish: (result: EvalResponse) => Promise<boolean>;
}

/**
 * @param params.mode - YL mode key
 * @param params.initialSessionId - reopened session; skips lazy creation
 * @param params.onSessionCreated - fired once when the row is created on the first turn
 * @param params.onSessionFinished - fired once the final evaluation is persisted
 * @returns lazy session handle: stash the generated plan, open on the first turn, finish at the end
 */
export function useYLSession({
  mode,
  initialSessionId,
  onSessionCreated,
  onSessionFinished,
}: UseYLSessionParams): UseYLSessionReturn {
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const sessionRef = useRef<string | undefined>(initialSessionId);
  const draftRef = useRef<{ plan: YLPlan | null; images: string[] }>({ plan: null, images: [] });
  const openingRef = useRef<Promise<string | null> | null>(null);

  const stash = useCallback((plan: YLPlan, images: string[] = []) => {
    draftRef.current = { plan, images };
  }, []);

  const open = useCallback(async (): Promise<string | null> => {
    if (sessionRef.current) return sessionRef.current;
    const draft = draftRef.current;
    if (!draft.plan) return null;
    if (!openingRef.current) {
      openingRef.current = openYLSessionAction({ mode, plan: draft.plan, images: draft.images }).then((result) => {
        openingRef.current = null;
        if (!result.ok) return null;
        sessionRef.current = result.data.sessionId;
        setSessionId(result.data.sessionId);
        onSessionCreated?.(result.data.sessionId);
        return result.data.sessionId;
      });
    }
    return openingRef.current;
  }, [mode, onSessionCreated]);

  const finish = useCallback(
    async (result: EvalResponse): Promise<boolean> => {
      const id = await open();
      if (!id) return false;
      const saved = await saveYLFinalEvalAction(id, result);
      if (!saved.ok) return false;
      onSessionFinished?.();
      return true;
    },
    [open, onSessionFinished],
  );

  return { sessionId, stash, open, finish };
}
