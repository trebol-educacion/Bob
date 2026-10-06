'use client';

import React, { useEffect } from 'react';
import { usePlacementRunner, type PlacementRunnerSkill } from '@/hooks/usePlacementRunner';
import { PlacementStepRunner } from './PlacementStepRunner';
import { PlacementUnavailable } from './PlacementUnavailable';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import type { AppState } from '@/lib/routing';

export interface PlacementRequiredProps {
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  refreshSkillLevels: () => Promise<void>;
  refreshPendingAssessments: () => Promise<void>;
}

const GATE_SKILL: PlacementRunnerSkill = 'reading';

/** @param props PlacementRequiredProps */
export function PlacementRequired({ setAppState, refreshSkillLevels, refreshPendingAssessments }: PlacementRequiredProps) {
  const { begin, status, step, stepsCompleted, startFailure, submitStep, cancel, reset } = usePlacementRunner();

  useEffect(() => {
    void begin(GATE_SKILL);
  }, [begin]);

  useEffect(() => {
    if (status !== 'cooldown' && status !== 'pending') return;
    reset();
    setAppState('skill-selection');
  }, [status, reset, setAppState]);

  useEffect(() => {
    if (status !== 'done') return;
    void (async () => {
      await refreshSkillLevels();
      await refreshPendingAssessments();
      reset();
      setAppState('skill-selection');
    })();
  }, [status, refreshSkillLevels, refreshPendingAssessments, reset, setAppState]);

  const handleCancel = () => {
    void cancel();
    setAppState('skill-selection');
  };

  const handleLeave = () => {
    reset();
    setAppState('skill-selection');
  };

  if (status === 'unavailable') {
    return (
      <PlacementUnavailable
        failure={startFailure}
        onRetry={() => void begin(GATE_SKILL)}
        onLeave={handleLeave}
        leaveLabel="continue"
      />
    );
  }

  if (step) {
    return (
      <PlacementStepRunner
        key={step.group.id}
        group={step.group}
        items={step.items}
        stepsCompleted={stepsCompleted}
        submitting={status === 'submitting'}
        failed={status === 'error'}
        onSubmitStep={(answers) => void submitStep(answers)}
        onCancel={handleCancel}
      />
    );
  }

  return <BobMascotLoader size="lg" message="Let's find your level…" />;
}
