'use client';

import { useCallback, useState } from 'react';
import { startPlacementAction, cancelPlacementAction } from '@/actions/placement/start';
import { answerPlacementStepAction } from '@/actions/placement/answer';
import type { ClosedAnswer } from '@/lib/item-bank/scoring';
import type { PublicBankItem, PublicItemGroup } from '@/lib/item-bank/types';
import type { PlacementLevel } from '@/lib/placement/types';

export type PlacementRunnerSkill = 'listening' | 'reading';

export interface PlacementStep {
  attemptId: string;
  group: PublicItemGroup;
  items: PublicBankItem[];
}

export type PlacementRunnerStatus =
  | 'idle'
  | 'loading'
  | 'curated'
  | 'unavailable'
  | 'cooldown'
  | 'pending'
  | 'submitting'
  | 'done'
  | 'error';

export interface PlacementStartFailure {
  code: string;
  retryable: boolean;
}

export interface UsePlacementRunnerResult {
  status: PlacementRunnerStatus;
  step: PlacementStep | null;
  stepsCompleted: number;
  resultLevel: PlacementLevel | null;
  startFailure: PlacementStartFailure | null;
  begin: (skill: PlacementRunnerSkill) => Promise<PlacementRunnerStatus>;
  submitStep: (answers: ClosedAnswer[]) => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
}

/**
 * @returns UsePlacementRunnerResult
 */
export function usePlacementRunner(): UsePlacementRunnerResult {
  const [status, setStatus] = useState<PlacementRunnerStatus>('idle');
  const [skill, setSkill] = useState<PlacementRunnerSkill | null>(null);
  const [step, setStep] = useState<PlacementStep | null>(null);
  const [stepsCompleted, setStepsCompleted] = useState(0);
  const [resultLevel, setResultLevel] = useState<PlacementLevel | null>(null);
  const [startFailure, setStartFailure] = useState<PlacementStartFailure | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setSkill(null);
    setStep(null);
    setStepsCompleted(0);
    setResultLevel(null);
    setStartFailure(null);
  }, []);

  const begin = useCallback(async (targetSkill: PlacementRunnerSkill): Promise<PlacementRunnerStatus> => {
    setStatus('loading');
    setSkill(targetSkill);
    setStepsCompleted(0);
    setResultLevel(null);
    setStartFailure(null);

    const started = await startPlacementAction(targetSkill);
    if (started.status === 'ok') {
      setStep({ attemptId: started.attempt_id, group: started.group, items: started.items });
      setStatus('curated');
      return 'curated';
    }

    setStep(null);
    if (started.status === 'cooldown' || started.status === 'pending') {
      setStatus(started.status);
      return started.status;
    }
    setStartFailure({ code: started.code, retryable: started.retryable });
    setStatus('unavailable');
    return 'unavailable';
  }, []);

  const submitStep = useCallback(async (answers: ClosedAnswer[]) => {
    if (!skill || !step) return;

    setStatus('submitting');
    const result = await answerPlacementStepAction(step.attemptId, skill, step.group.id, answers);

    if (result.status === 'error') {
      setStatus('error');
      return;
    }

    if (!result.done) {
      setStep({ attemptId: result.attempt_id, group: result.group, items: result.items });
      setStepsCompleted((n) => n + 1);
      setStatus('curated');
      return;
    }

    setStep(null);
    setStepsCompleted((n) => n + 1);
    setResultLevel(result.result_level);
    setStatus('done');
  }, [skill, step]);

  const cancel = useCallback(async () => {
    if (step) {
      await cancelPlacementAction(step.attemptId);
    }
    reset();
  }, [step, reset]);

  return { status, step, stepsCompleted, resultLevel, startFailure, begin, submitStep, cancel, reset };
}
