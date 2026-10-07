'use client';

import { useCallback, useState } from 'react';
import { startAssessmentAction } from '@/actions/assessment';
import { pickInitialSkillLevelAction, resetOwnSkillLevelAction } from '@/actions/skills';
import { resolveLevelPolicy } from '@/lib/levels/level-policy';
import type { AssessmentPrompt, AssessmentWritingTask } from '@/actions/assessment';
import type { AppState } from '@/lib/routing';
import type { CefrLevel } from '@/lib/types/practice';
import type {
  Skill,
  SkillLevelMap,
} from '@/lib/types/skills';

export interface UseAssessmentFlowParams {
  selectedSkill: Skill | null;
  setSelectedSkill: (skill: Skill | null) => void;
  skillLevels: SkillLevelMap | null;
  refreshSkillLevels: () => Promise<void>;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  cefrLevelLocked: boolean;
  cefrActiveLevel: CefrLevel | null;
}

export function useAssessmentFlow({
  selectedSkill,
  setSelectedSkill,
  skillLevels,
  refreshSkillLevels,
  setAppState,
  cefrLevelLocked,
  cefrActiveLevel,
}: UseAssessmentFlowParams) {
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [assessmentPrompts, setAssessmentPrompts] = useState<AssessmentPrompt[]>([]);
  const [assessmentIsYl, setAssessmentIsYl] = useState(false);
  const [assessmentWritingTask, setAssessmentWritingTask] = useState<AssessmentWritingTask | null>(null);

  const handleSkillSelect = useCallback((skill: Skill) => {
    setSelectedSkill(skill);
    const level = skillLevels?.[skill];
    if (level?.cefr_level) {
      setAppState('catalog-filtered');
      return;
    }
    const policy = resolveLevelPolicy({
      cefrLevelLocked,
      cefrActiveLevel,
      testerOverrideEnabled: false,
    });
    setAppState(policy.skipPlacement ? 'catalog-filtered' : 'assessment-invite');
  }, [skillLevels, setSelectedSkill, setAppState, cefrLevelLocked, cefrActiveLevel]);

  const handleAssessmentStart = useCallback(async () => {
    if (!selectedSkill) return;
    const result = await startAssessmentAction(selectedSkill);
    if (result.status === 'ok') {
      setAssessmentId(result.assessment_id);
      if (result.skill === 'writing') {
        setAssessmentWritingTask(result.task);
        setAssessmentPrompts([]);
      } else {
        setAssessmentPrompts(result.prompts);
        setAssessmentIsYl(result.is_yl);
        setAssessmentWritingTask(null);
      }
      setAppState('assessment-running');
    } else {
      setAppState('assessment-invite');
    }
  }, [selectedSkill, setAppState]);

  const handleResetSkillLevel = useCallback(async () => {
    if (!selectedSkill) return;
    const result = await resetOwnSkillLevelAction(selectedSkill);
    if (result.ok) {
      await refreshSkillLevels();
      setAppState('assessment-invite');
    }
  }, [selectedSkill, refreshSkillLevels, setAppState]);

  const handlePickLevel = useCallback(async (level: CefrLevel) => {
    if (!selectedSkill) return;
    const existing = skillLevels?.[selectedSkill]?.cefr_level;
    if (existing !== level) {
      const result = await pickInitialSkillLevelAction(selectedSkill, level);
      if (result.ok) {
        await refreshSkillLevels();
      }
    }
    setAppState('catalog-filtered');
  }, [selectedSkill, skillLevels, refreshSkillLevels, setAppState]);

  return {
    assessmentId,
    assessmentPrompts,
    assessmentIsYl,
    assessmentWritingTask,
    handleSkillSelect,
    handleAssessmentStart,
    handleResetSkillLevel,
    handlePickLevel,
  };
}
