'use client';

import React from 'react';
import { AssessmentInvite } from '@/components/assessment/AssessmentInvite';
import { AssessmentSpeakingRunner } from '@/components/assessment/AssessmentSpeakingRunner';
import { AssessmentListeningRunner } from '@/components/assessment/AssessmentListeningRunner';
import { AssessmentReadingRunner } from '@/components/assessment/AssessmentReadingRunner';
import { AssessmentWritingRunner } from '@/components/assessment/AssessmentWritingRunner';
import { AssessmentResultCard } from '@/components/assessment/AssessmentResultCard';
import type { AssessmentPrompt, AssessmentListeningItem, AssessmentReadingItem, AssessmentWritingTask } from '@/actions/assessment';
import type { AppState } from '@/lib/routing';
import type { CefrLevel } from '@/lib/types/practice';
import type { Skill } from '@/lib/types/skills';
import type { AssessmentResultUnion } from '@/hooks/useAssessmentFlow';

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
  if (appState === 'assessment-invite' && selectedSkill) {
    return (
      <AssessmentInvite
        skill={selectedSkill}
        onStartAssessment={handleAssessmentStart}
        onPickLevel={handlePickLevel}
        onBack={() => setAppState('skill-selection')}
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
