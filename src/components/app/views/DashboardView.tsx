'use client';

import React from 'react';
import { StudentStatsPanel } from '@/components/StudentStatsPanel';
import { applyDefaultSkillLevelAction, promoteSkillLevelAction } from '@/actions/skills';
import { useOrganization } from '@/hooks/useOrganization';
import { resolveLevelPolicy } from '@/lib/levels/level-policy';
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
  const { cefrLevelLocked, cefrActiveLevel } = useOrganization();
  const levelPolicy = resolveLevelPolicy({ cefrLevelLocked, cefrActiveLevel, testerOverrideEnabled: false });

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
      onChangeLevel={levelPolicy.skipPlacement ? undefined : async (skill, level) => {
        const result = await applyDefaultSkillLevelAction(skill, level as CefrLevel);
        if (result.ok) {
          await refreshSkillLevels();
        }
      }}
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
