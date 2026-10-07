'use client';

import React, { useEffect, useState } from 'react';
import { StudentStatsPanel } from '@/components/StudentStatsPanel';
import { changeSkillLevelAction, isLevelSelectorEnabledAction, promoteSkillLevelAction } from '@/actions/skills';
import type { AppState } from '@/lib/routing';
import type { CefrLevel } from '@/lib/types/practice';
import type { Skill } from '@/lib/types/skills';

export interface DashboardViewProps {
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  setSelectedSkill: (skill: Skill | null) => void;
  refreshSessions: () => void;
  refreshSkillLevels: () => Promise<void>;
}

export function DashboardView({
  setAppState,
  setSelectedSkill,
  refreshSessions,
  refreshSkillLevels,
}: DashboardViewProps) {
  const [levelSelectorEnabled, setLevelSelectorEnabled] = useState(false);

  useEffect(() => {
    void isLevelSelectorEnabledAction().then(setLevelSelectorEnabled);
  }, []);

  const changeLevel = async (skill: Skill, level: string) => {
    const result = await changeSkillLevelAction(skill, level as CefrLevel);
    if (result.ok) await refreshSkillLevels();
  };

  return (
    <StudentStatsPanel
      onBack={() => setAppState('skill-selection')}
      onAfterReset={() => {
        void refreshSessions();
      }}
      onTakeAssessment={(skill) => {
        setSelectedSkill(skill);
        setAppState('assessment-invite');
      }}
      onChangeLevel={levelSelectorEnabled ? changeLevel : undefined}
      onLevelUp={async (skill, level) => {
        const result = await promoteSkillLevelAction(skill, level as CefrLevel);
        if (result.ok) {
          await refreshSkillLevels();
        }
      }}
      onOpenChallenge={() => setAppState('challenge')}
    />
  );
}
