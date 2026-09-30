'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startFCEReadingExerciseAction,
  submitFCEReadingExerciseAction,
} from '@/actions/modes/fce-reading-grouped';
import type { StoredMessage } from '@/actions/messages';
import type {
  FCEGroupedExercise,
  FCEGroupedItemResult,
  FCEGroupedPart,
  FCEGroupedScore,
} from '@/lib/reading/fce-grouped-types';
import { restoreGroupedExercise } from './restore';

export type GroupedPhase = 'loading' | 'ready' | 'submitting' | 'finished' | 'error';

interface UseGroupedExerciseInput {
  part: FCEGroupedPart;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
}

/**
 * @param input
 * @returns exercise state and handlers for a grouped Reading part
 */
export function useGroupedExercise({
  part,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
}: UseGroupedExerciseInput) {
  const [restored] = useState(() =>
    initialMessages && initialMessages.length > 0 ? restoreGroupedExercise(part, initialMessages) : null
  );
  const [phase, setPhase] = useState<GroupedPhase>(() => {
    if (restored) return restored.results ? 'finished' : 'ready';
    return initialSessionId ? 'error' : 'loading';
  });
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [exercise, setExercise] = useState<FCEGroupedExercise | null>(restored?.exercise ?? null);
  const [answers, setAnswers] = useState<Record<number, string>>(() =>
    Object.fromEntries((restored?.results ?? []).map((r) => [r.number, r.given]))
  );
  const [results, setResults] = useState<FCEGroupedItemResult[] | null>(restored?.results ?? null);
  const [score, setScore] = useState<FCEGroupedScore | null>(restored?.score ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    !restored && initialSessionId ? 'Exercise not found' : null
  );
  const [isNewSession, setIsNewSession] = useState(false);
  const startedRef = useRef(false);

  const applyStart = useCallback(
    (started: Awaited<ReturnType<typeof startFCEReadingExerciseAction>>) => {
      if ('error' in started) {
        setErrorMessage(started.error);
        setPhase('error');
        return;
      }
      setIsNewSession(true);
      setSessionId(started.sessionId);
      setExercise(started.exercise);
      setAnswers({});
      setErrorMessage(null);
      onSessionCreated?.(started.sessionId);
      setPhase('ready');
    },
    [onSessionCreated]
  );

  useEffect(() => {
    if (startedRef.current || restored || initialSessionId) return;
    startedRef.current = true;
    void startFCEReadingExerciseAction({ part }).then(applyStart);
  }, [restored, initialSessionId, part, applyStart]);

  const setAnswer = useCallback((number: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [number]: value }));
  }, []);

  const submit = useCallback(async () => {
    if (!exercise || !sessionId) return;
    setPhase('submitting');
    const submitted = await submitFCEReadingExerciseAction({
      sessionId,
      part,
      groupId: exercise.groupId,
      answers,
    });
    if ('error' in submitted) {
      setErrorMessage(submitted.error);
      setPhase('error');
      return;
    }
    setResults(submitted.results);
    setScore({ correct: submitted.correct, total: submitted.total, score10: submitted.score10 });
    setPhase('finished');
    onSessionFinished?.();
  }, [exercise, sessionId, part, answers, onSessionFinished]);

  const retry = useCallback(() => {
    if (exercise && sessionId) {
      setPhase('ready');
      setErrorMessage(null);
      return;
    }
    setPhase('loading');
    void startFCEReadingExerciseAction({ part }).then(applyStart);
  }, [exercise, sessionId, part, applyStart]);

  return { phase, exercise, answers, results, score, errorMessage, isNewSession, setAnswer, submit, retry };
}
