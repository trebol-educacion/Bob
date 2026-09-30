'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoredMessage } from '@/actions/messages';
import { resolveActivityBoot } from '@/lib/activity/boot';
import { restoreGroupSession } from '@/lib/item-bank/group-restore';
import type {
  GroupAnswers,
  GroupExercisePayload,
  GroupStartResult,
  GroupSubmitOutcome,
  GroupSubmitResult,
} from '@/lib/item-bank/group-types';

export type GroupPhase = 'loading' | 'ready' | 'submitting' | 'finished' | 'error';

export interface GroupExerciseApi {
  start: () => Promise<GroupStartResult>;
  submit: (sessionId: string, answers: GroupAnswers) => Promise<GroupSubmitOutcome>;
}

export interface UseGroupExerciseParams {
  api: GroupExerciseApi;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
}

export interface GroupExerciseController {
  phase: GroupPhase;
  exercise: GroupExercisePayload | null;
  answers: GroupAnswers;
  result: GroupSubmitResult | null;
  errorMessage: string | null;
  isNewSession: boolean;
  setAnswer: (questionId: string, value: string) => void;
  submit: () => Promise<void>;
  retry: () => void;
}

type BootState =
  | { kind: 'generate' }
  | { kind: 'restore-failed' }
  | { kind: 'restore'; exercise: GroupExercisePayload; result: GroupSubmitResult | null };

function resolveBoot(params: Pick<UseGroupExerciseParams, 'initialMessages' | 'sessionId'>): BootState {
  const boot = resolveActivityBoot({ ...params, tryRestore: restoreGroupSession });
  if (boot.kind === 'restore') return { kind: 'restore', ...boot.data };
  return { kind: boot.kind };
}

export function useGroupExercise({
  api,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
}: UseGroupExerciseParams): GroupExerciseController {
  const [boot] = useState(() => resolveBoot({ initialMessages, sessionId: initialSessionId }));
  const [phase, setPhase] = useState<GroupPhase>(() => {
    if (boot.kind === 'restore') return boot.result ? 'finished' : 'ready';
    return boot.kind === 'restore-failed' ? 'error' : 'loading';
  });
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [exercise, setExercise] = useState<GroupExercisePayload | null>(boot.kind === 'restore' ? boot.exercise : null);
  const [answers, setAnswers] = useState<GroupAnswers>({});
  const [result, setResult] = useState<GroupSubmitResult | null>(boot.kind === 'restore' ? boot.result : null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    boot.kind === 'restore-failed' ? 'Could not restore this session. Please start a new one.' : null,
  );
  const [isNewSession, setIsNewSession] = useState(false);
  const startedRef = useRef(false);

  const applyStart = useCallback(
    (started: GroupStartResult) => {
      if ('error' in started) {
        setErrorMessage(started.error);
        setPhase('error');
        return;
      }
      setIsNewSession(true);
      setSessionId(started.session_id);
      setExercise(started.exercise);
      setAnswers({});
      setResult(null);
      setErrorMessage(null);
      onSessionCreated?.(started.session_id);
      setPhase('ready');
    },
    [onSessionCreated],
  );

  useEffect(() => {
    if (startedRef.current || boot.kind !== 'generate') return;
    startedRef.current = true;
    void api.start().then(applyStart);
  }, [api, applyStart, boot.kind]);

  const setAnswer = useCallback((questionId: string, value: string) => {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
  }, []);

  const submit = useCallback(async () => {
    if (!sessionId) return;
    setPhase('submitting');
    const outcome = await api.submit(sessionId, answers);
    if ('error' in outcome) {
      setErrorMessage('Could not check your answers. Please try again.');
      setPhase('ready');
      return;
    }
    setErrorMessage(null);
    setResult(outcome);
    setPhase('finished');
    onSessionFinished?.();
  }, [api, sessionId, answers, onSessionFinished]);

  const retry = useCallback(() => {
    setPhase('loading');
    setErrorMessage(null);
    void api.start().then(applyStart);
  }, [api, applyStart]);

  return { phase, exercise, answers, result, errorMessage, isNewSession, setAnswer, submit, retry };
}
