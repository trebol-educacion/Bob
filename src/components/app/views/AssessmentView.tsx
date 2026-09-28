'use client';

import React, { useCallback, useEffect } from 'react';
import { AssessmentInvite } from '@/components/assessment/AssessmentInvite';
import { AssessmentSpeakingRunner } from '@/components/assessment/AssessmentSpeakingRunner';
import { AssessmentListeningRunner } from '@/components/assessment/AssessmentListeningRunner';
import { AssessmentReadingRunner } from '@/components/assessment/AssessmentReadingRunner';
import { AssessmentWritingRunner } from '@/components/assessment/AssessmentWritingRunner';
import { AssessmentResultCard } from '@/components/assessment/AssessmentResultCard';
import { PlacementStepRunner } from '@/components/placement/PlacementStepRunner';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { usePlacementRunner } from '@/hooks/usePlacementRunner';
import type { AssessmentPrompt, AssessmentListeningItem, AssessmentReadingItem, AssessmentWritingTask } from '@/actions/assessment';
import type { AppState } from '@/lib/routing';
import type { CefrLevel } from '@/lib/types/practice';
import type { Skill } from '@/lib/types/skills';
import type { AssessmentResultUnion } from '@/hooks/useAssessmentFlow';

/**
 * @param skill Skill | null
 * @returns skill is 'listening' | 'reading'
 */
function isPlacementRunnerSkill(skill: Skill | null): skill is 'listening' | 'reading' {
  return skill === 'listening' || skill === 'reading';
}

export interface AssessmentViewProps {
  appState: Extract<AppState, 'assessment-invite' | 'assessment-running' | 'assessment-result'>;
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
  assessmentListeningItems: AssessmentListeningItem[];
  assessmentReadingItems: AssessmentReadingItem[];
  assessmentWritingTask: AssessmentWritingTask | null;
  assessmentResult: AssessmentResultUnion | null;
  setAssessmentResult: (result: AssessmentResultUnion | null) => void;
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
  assessmentListeningItems,
  assessmentReadingItems,
  assessmentWritingTask,
  assessmentResult,
  setAssessmentResult,
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
      if (result === 'curated') {
        setAppState('assessment-running');
        return;
      }
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
    void (async () => {
      await refreshSkillLevels();
      await refreshPendingAssessments();
      resetPlacementRunner();
      leavePractice('catalog-filtered');
    })();
  }, [placementRunner.status, refreshSkillLevels, refreshPendingAssessments, resetPlacementRunner, leavePractice]);

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
    return <BobMascotLoader size="lg" message="Great job! Preparing your practice…" />;
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

  if (appState === 'assessment-running' && assessmentId && assessmentListeningItems.length > 0) {
    return (
      <AssessmentListeningRunner
        assessment_id={assessmentId}
        items={assessmentListeningItems}
        onResult={async (result) => {
          setAssessmentResult(result);
          await refreshSkillLevels();
          setAppState('assessment-result');
        }}
        onCancel={() => requestLeaveConfirmation(() => setAppState('assessment-invite'))}
      />
    );
  }

  if (appState === 'assessment-running' && assessmentId && assessmentReadingItems.length > 0) {
    return (
      <AssessmentReadingRunner
        assessment_id={assessmentId}
        items={assessmentReadingItems}
        onResult={async (result) => {
          setAssessmentResult(result);
          await refreshSkillLevels();
          setAppState('assessment-result');
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

  if (appState === 'assessment-result' && assessmentResult) {
    return (
      <AssessmentResultCard
        result={assessmentResult}
        onPracticeNow={() => leavePractice('catalog-filtered')}
      />
    );
  }

  return null;
}
