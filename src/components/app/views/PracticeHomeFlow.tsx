'use client';

import React, { useState } from 'react';
import { HomeView } from './HomeView';
import { PracticeModeSelectView } from './PracticeModeSelectView';
import { PracticeSessionView } from './PracticeSessionView';
import { PracticeTopicSelectContainer } from '@/components/practice/free/PracticeTopicSelectContainer';
import type { PracticeResumeInput } from '@/hooks/practice/usePracticeBoot';
import type { AppState } from '@/lib/routing';
import type { Organization } from '@/lib/organization';
import type { CefrLevel } from '@/lib/types/practice';
import type { PracticeActivityMode } from '@/lib/practice/types';
import type { SkillLevelMap } from '@/lib/types/skills';

const TOPIC_MODES: readonly PracticeActivityMode[] = ['conversation', 'presentation'];

export interface PracticeHomeFlowProps {
  appState: AppState;
  organization: Organization | null;
  cefrActiveLevel: CefrLevel | null;
  skillLevels: SkillLevelMap | null;
  onSelectExam: () => void;
  onSelectPractice: () => void;
  practiceMode: PracticeActivityMode;
  practiceTopicSlug: string | null;
  onSelectPracticeMode: (mode: PracticeActivityMode, topicSlug: string | null) => void;
  onExitPractice: () => void;
  resume?: PracticeResumeInput;
  onSessionCreated: (sessionId: string) => void;
  onSessionFinished: () => void;
  onPracticeAgain: () => void;
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
  practiceTopicSlug,
  onSelectPracticeMode,
  onExitPractice,
  resume,
  onSessionCreated,
  onSessionFinished,
  onPracticeAgain,
}: PracticeHomeFlowProps) {
  const [topicMode, setTopicMode] = useState<PracticeActivityMode | null>(null);

  if (appState === 'practice-mode-select') {
    if (topicMode) {
      return (
        <PracticeTopicSelectContainer
          skillLevels={skillLevels}
          cefrActiveLevel={cefrActiveLevel}
          onSelectTopic={(slug) => onSelectPracticeMode(topicMode, slug)}
          onBack={() => setTopicMode(null)}
        />
      );
    }
    return (
      <PracticeModeSelectView
        onSelectMode={(mode) => (TOPIC_MODES.includes(mode) ? setTopicMode(mode) : onSelectPracticeMode(mode, null))}
      />
    );
  }

  if (appState === 'practice-session') {
    return (
      <PracticeSessionView
        key={`${practiceMode}:${practiceTopicSlug ?? 'random'}:${resume?.sessionId ?? 'new'}`}
        mode={practiceMode}
        topicSlug={practiceTopicSlug}
        resume={resume}
        onSessionCreated={onSessionCreated}
        onSessionFinished={onSessionFinished}
        onPracticeAgain={onPracticeAgain}
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
