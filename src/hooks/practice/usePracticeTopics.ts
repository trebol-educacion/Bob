'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listPracticeTopicsAction } from '@/actions/practice/topics';
import type { PracticeTopicArea } from '@/lib/practice/topics';
import type { CefrLevel } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';

export interface UsePracticeTopicsArgs {
  skillLevels: SkillLevelMap | null;
  cefrActiveLevel: CefrLevel | null;
}

export type PracticeTopicsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; areas: PracticeTopicArea[] };

/**
 * @param args - level inputs read once per attempt
 * @returns topics state machine and a reload callback
 */
export function usePracticeTopics(args: UsePracticeTopicsArgs): PracticeTopicsState & { reload: () => void } {
  const argsRef = useRef(args);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PracticeTopicsState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    listPracticeTopicsAction(argsRef.current)
      .then((result) => {
        if (cancelled) return;
        setState(result.ok ? { status: 'ready', areas: result.data } : { status: 'error' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
