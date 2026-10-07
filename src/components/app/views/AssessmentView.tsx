'use client';

import React, { useCallback, useEffect } from 'react';
import { AssessmentInvite } from '@/components/assessment/AssessmentInvite';
import { AssessmentSpeakingRunner } from '@/components/assessment/AssessmentSpeakingRunner';
import { AssessmentWritingRunner } from '@/components/assessment/AssessmentWritingRunner';
import { PlacementUnavailable } from '@/components/placement/PlacementUnavailable';
import { PlacementStepRunner } from '@/components/placement/PlacementStepRunner';
import { PlacementResult } from '@/components/placement/PlacementResult';
import { usePlacementRunner } from '@/hooks/usePlacementRunner';
import type { AssessmentPrompt, AssessmentWritingTask } from '@/actions/assessment';
import type { AppState } from '@/lib/routing';
import type { CefrLevel } from '@/lib/types/practice';
import type { Skill } from '@/lib/types/skills';

/**
 * @param skill Skill | null
 * @returns skill is 'listening' | 'reading'
 */
function isPlacementRunnerSkill(skill: Skill | null): skill is 'listening' | 'reading' {
  return skill === 'listening' || skill === 'reading';
}

export interface AssessmentViewProps {
  appState: Extract<AppState, 'assessment-invite' | 'assessment-running'>;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  leavePractice: (target: AppState) => void;
  selectedSkill: Skill | null;
  handleAssessmentStart: () => void;
  handlePickLevel: (level: CefrLevel) => void;
  refreshSkillLevels: () => Promise<void>;
  refreshPendingAssessments: () => Promise<void>;
  requestLeaveConfirmation: (action: () => void) => void;
  assessmentId: string | null;
  assessmentPrompts: AssessmentPrompt[];
  assessmentIsYl: boolean;
  assessmentWritingTask: AssessmentWritingTask | null;
}

export function AssessmentView({
  appState,
  setAppState,
  leavePractice,
  selectedSkill,
  handleAssessmentStart,
  handlePickLevel,
  refreshSkillLevels,
  refreshPendingAssessments,
  requestLeaveConfirmation,
  assessmentId,
  assessmentPrompts,
  assessmentIsYl,
  assessmentWritingTask,
}: AssessmentViewProps) {
  const placementRunner = usePlacementRunner();
  const resetPlacementRunner = placementRunner.reset;

  useEffect(() => {
    if (appState === 'assessment-invite') {
      resetPlacementRunner();
    }
  }, [appState, selectedSkill, resetPlacementRunner]);

  const handleStartAssessment = useCallback(async () => {
    if (isPlacementRunnerSkill(selectedSkill)) {
      const result = await placementRunner.begin(selectedSkill);
      if (result === 'curated') setAppState('assessment-running');
      return;
    }
    handleAssessmentStart();
  }, [selectedSkill, placementRunner, setAppState, handleAssessmentStart]);

  const handlePlacementCancel = useCallback(() => {
    requestLeaveConfirmation(() => {
      void placementRunner.cancel();
      setAppState('assessment-invite');
    });
  }, [requestLeaveConfirmation, placementRunner, setAppState]);

  useEffect(() => {
    if (placementRunner.status !== 'done') return;
    void refreshSkillLevels();
    void refreshPendingAssessments();
  }, [placementRunner.status, refreshSkillLevels, refreshPendingAssessments]);

  if (appState === 'assessment-invite' && selectedSkill && placementRunner.status === 'unavailable') {
    return (
      <PlacementUnavailable
        failure={placementRunner.startFailure}
        onRetry={() => void handleStartAssessment()}
        onLeave={resetPlacementRunner}
        leaveLabel="back"
      />
    );
  }

  if (appState === 'assessment-invite' && selectedSkill) {
    return (
      <AssessmentInvite
        skill={selectedSkill}
        onStartAssessment={handleStartAssessment}
        onPickLevel={handlePickLevel}
        onBack={() => setAppState('skill-selection')}
      />
    );
  }

  if (appState === 'assessment-running' && placementRunner.step) {
    return (
      <PlacementStepRunner
        key={placementRunner.step.group.id}
        group={placementRunner.step.group}
        items={placementRunner.step.items}
        stepsCompleted={placementRunner.stepsCompleted}
        submitting={placementRunner.status === 'submitting'}
        failed={placementRunner.status === 'error'}
        onSubmitStep={(answers) => void placementRunner.submitStep(answers)}
        onCancel={handlePlacementCancel}
      />
    );
  }

  if (appState === 'assessment-running' && placementRunner.status === 'done') {
    return (
      <PlacementResult
        skill={selectedSkill ?? ''}
        level={placementRunner.resultLevel}
        onContinue={() => {
          resetPlacementRunner();
          leavePractice('catalog-filtered');
        }}
      />
    );
  }

  if (appState === 'assessment-running' && assessmentId && assessmentPrompts.length > 0) {
    return (
      <AssessmentSpeakingRunner
        assessment_id={assessmentId}
        prompts={assessmentPrompts}
        is_yl={assessmentIsYl}
        onQueued={async () => {
          await refreshPendingAssessments();
          setAppState('dashboard');
        }}
        onCancel={() => requestLeaveConfirmation(() => setAppState('assessment-invite'))}
      />
    );
  }

  if (appState === 'assessment-running' && assessmentId && assessmentWritingTask) {
    return (
      <AssessmentWritingRunner
        assessment_id={assessmentId}
        task={assessmentWritingTask}
        onQueued={async () => {
          await refreshPendingAssessments();
          setAppState('dashboard');
        }}
        onCancel={() => requestLeaveConfirmation(() => setAppState('assessment-invite'))}
      />
    );
  }

  return null;
}
