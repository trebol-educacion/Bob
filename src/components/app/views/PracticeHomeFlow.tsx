'use client';

import React from 'react';
import { HomeView } from './HomeView';
import { PracticeModeSelectView } from './PracticeModeSelectView';
import { PracticeSessionView } from './PracticeSessionView';
import type { AppState } from '@/lib/routing';
import type { Organization } from '@/lib/organization';
import type { CefrLevel } from '@/lib/types/practice';
import type { PracticeActivityMode } from '@/lib/practice/types';
import type { SkillLevelMap } from '@/lib/types/skills';

export interface PracticeHomeFlowProps {
  appState: AppState;
  organization: Organization | null;
  cefrActiveLevel: CefrLevel | null;
  skillLevels: SkillLevelMap | null;
  onSelectExam: () => void;
  onSelectPractice: () => void;
  practiceMode: PracticeActivityMode;
  onSelectPracticeMode: (mode: PracticeActivityMode) => void;
  onExitPractice: () => void;
}

/**
 * @param props PracticeHomeFlowProps
 */
export function PracticeHomeFlow({
  appState,
  organization,
  cefrActiveLevel,
  skillLevels,
  onSelectExam,
  onSelectPractice,
  practiceMode,
  onSelectPracticeMode,
  onExitPractice,
}: PracticeHomeFlowProps) {
  if (appState === 'practice-mode-select') {
    return <PracticeModeSelectView onSelectMode={onSelectPracticeMode} />;
  }

  if (appState === 'practice-session') {
    return (
      <PracticeSessionView
        mode={practiceMode}
        organization={organization}
        cefrActiveLevel={cefrActiveLevel}
        skillLevels={skillLevels}
        onExit={onExitPractice}
      />
    );
  }

  return (
    <HomeView
      organization={organization}
      cefrActiveLevel={cefrActiveLevel}
      onSelectExam={onSelectExam}
      onSelectPractice={onSelectPractice}
    />
  );
}
