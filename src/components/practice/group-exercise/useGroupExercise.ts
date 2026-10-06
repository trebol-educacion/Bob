'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoredMessage } from '@/actions/messages';
import { resolveActivityBoot } from '@/lib/activity/boot';
import {
  isGroupFailure,
  type GroupStartOutcome,
  type GroupSubmitInput,
  type GroupSubmitOutcome,
  type RestoredGroupSession,
} from '@/lib/item-bank/group-session-types';

export type GroupPhase = 'loading' | 'ready' | 'submitting' | 'finished' | 'error';

type AnswerKey = string | number;

export interface GroupExerciseApi<E, K extends AnswerKey, R> {
  start: () => Promise<GroupStartOutcome<E>>;
  submit: (input: GroupSubmitInput<Record<K, string>>) => Promise<GroupSubmitOutcome<R>>;
  restore: (messages: StoredMessage[]) => RestoredGroupSession<E, R> | null;
  answersOf?: (result: R) => Record<K, string>;
}

export interface UseGroupExerciseParams<E, K extends AnswerKey, R> {
  api: GroupExerciseApi<E, K, R>;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
}

export interface GroupExerciseController<E, K extends AnswerKey, R> {
  phase: GroupPhase;
  exercise: E | null;
  answers: Record<K, string>;
  result: R | null;
  errorMessage: string | null;
  isNewSession: boolean;
  setAnswer: (key: K, value: string) => void;
  submit: () => Promise<void>;
  retry: () => void;
}

type BootState<E, R> =
  | { kind: 'generate' }
  | { kind: 'restore-failed' }
  | { kind: 'restore'; exercise: E; result: R | null };

function resolveBoot<E, K extends AnswerKey, R>(
  api: GroupExerciseApi<E, K, R>,
  params: Pick<UseGroupExerciseParams<E, K, R>, 'initialMessages' | 'sessionId'>,
): BootState<E, R> {
  const boot = resolveActivityBoot({ ...params, tryRestore: api.restore });
  if (boot.kind === 'restore') return { kind: 'restore', ...boot.data };
  return { kind: boot.kind };
}

/**
 * @template E
 * @template K
 * @template R
 * @param params
 * @returns session state and handlers shared by every grouped part
 */
export function useGroupExercise<E extends { groupId: string }, K extends AnswerKey, R>({
  api,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
}: UseGroupExerciseParams<E, K, R>): GroupExerciseController<E, K, R> {
  const [boot] = useState(() => resolveBoot(api, { initialMessages, sessionId: initialSessionId }));
  const restoredResult = boot.kind === 'restore' ? boot.result : null;
  const [phase, setPhase] = useState<GroupPhase>(() => {
    if (boot.kind === 'restore') return boot.result ? 'finished' : 'ready';
    return boot.kind === 'restore-failed' ? 'error' : 'loading';
  });
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [exercise, setExercise] = useState<E | null>(boot.kind === 'restore' ? boot.exercise : null);
  const [answers, setAnswers] = useState<Record<K, string>>(
    () => (restoredResult && api.answersOf ? api.answersOf(restoredResult) : ({} as Record<K, string>)),
  );
  const [result, setResult] = useState<R | null>(restoredResult);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    boot.kind === 'restore-failed' ? 'Could not restore this session. Please start a new one.' : null,
  );
  const [isNewSession, setIsNewSession] = useState(false);
  const startedRef = useRef(false);

  const applyStart = useCallback(
    (started: GroupStartOutcome<E>) => {
      if (isGroupFailure(started)) {
        setErrorMessage(started.error);
        setPhase('error');
        return;
      }
      setIsNewSession(true);
      setExercise(started.exercise);
      setAnswers({} as Record<K, string>);
      setResult(null);
      setErrorMessage(null);
      setPhase('ready');
    },
    [],
  );

  useEffect(() => {
    if (startedRef.current || boot.kind !== 'generate') return;
    startedRef.current = true;
    void api.start().then(applyStart);
  }, [api, applyStart, boot.kind]);

  const setAnswer = useCallback((key: K, value: string) => {
    setAnswers((previous) => ({ ...previous, [key]: value }));
  }, []);

  const submit = useCallback(async () => {
    if (!exercise) return;
    setPhase('submitting');
    const outcome = await api.submit({ sessionId, groupId: exercise.groupId, answers });
    if (isGroupFailure(outcome)) {
      setErrorMessage(outcome.error);
      setPhase('ready');
      return;
    }
    setErrorMessage(null);
    if (!sessionId) {
      setSessionId(outcome.sessionId);
      onSessionCreated?.(outcome.sessionId);
    }
    setResult(outcome.result);
    setPhase('finished');
    onSessionFinished?.();
  }, [api, exercise, sessionId, answers, onSessionCreated, onSessionFinished]);

  const retry = useCallback(() => {
    if (exercise) {
      setPhase('ready');
      setErrorMessage(null);
      return;
    }
    setPhase('loading');
    setErrorMessage(null);
    void api.start().then(applyStart);
  }, [api, exercise, applyStart]);

  return { phase, exercise, answers, result, errorMessage, isNewSession, setAnswer, submit, retry };
}
