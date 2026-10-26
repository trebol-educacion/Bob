'use client';

import React from 'react';
import { PracticeTopicSelectView } from './PracticeTopicSelectView';
import { usePracticeTopics } from '@/hooks/practice/usePracticeTopics';
import type { CefrLevel } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';

export interface PracticeTopicSelectContainerProps {
  skillLevels: SkillLevelMap | null;
  cefrActiveLevel: CefrLevel | null;
  onSelectTopic: (slug: string | null) => void;
  onBack: () => void;
}

/** @param props PracticeTopicSelectContainerProps */
export function PracticeTopicSelectContainer({
  skillLevels,
  cefrActiveLevel,
  onSelectTopic,
  onBack,
}: PracticeTopicSelectContainerProps) {
  const { reload, ...topics } = usePracticeTopics({ skillLevels, cefrActiveLevel });

  return (
    <PracticeTopicSelectView
      topics={topics}
      onSelectTopic={onSelectTopic}
      onSurprise={() => onSelectTopic(null)}
      onReload={reload}
      onBack={onBack}
    />
  );
}
