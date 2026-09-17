'use client';

import { useCallback, useState } from 'react';
import { startAssessmentAction } from '@/actions/assessment';
import { applyDefaultSkillLevelAction, resetOwnSkillLevelAction } from '@/actions/skills';
import type { AssessmentPrompt, AssessmentListeningItem, AssessmentReadingItem, AssessmentWritingTask } from '@/actions/assessment';
import type { AppState } from '@/lib/routing';
import type { CefrLevel } from '@/lib/types/practice';
import type {
  Skill,
  SkillLevelMap,
  AssessmentResultSpeaking,
  AssessmentResultListening,
  AssessmentResultReading,
  AssessmentResultWriting,
} from '@/lib/types/skills';

export type AssessmentResultUnion =
  | AssessmentResultSpeaking
  | AssessmentResultListening
  | AssessmentResultReading
  | AssessmentResultWriting;

export interface UseAssessmentFlowParams {
  selectedSkill: Skill | null;
  setSelectedSkill: (skill: Skill | null) => void;
  skillLevels: SkillLevelMap | null;
  refreshSkillLevels: () => Promise<void>;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function useAssessmentFlow({
  selectedSkill,
  setSelectedSkill,
  skillLevels,
  refreshSkillLevels,
  setAppState,
}: UseAssessmentFlowParams) {
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [assessmentPrompts, setAssessmentPrompts] = useState<AssessmentPrompt[]>([]);
  const [assessmentIsYl, setAssessmentIsYl] = useState(false);
  const [assessmentListeningItems, setAssessmentListeningItems] = useState<AssessmentListeningItem[]>([]);
  const [assessmentReadingItems, setAssessmentReadingItems] = useState<AssessmentReadingItem[]>([]);
  const [assessmentWritingTask, setAssessmentWritingTask] = useState<AssessmentWritingTask | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResultUnion | null>(null);

  const handleSkillSelect = useCallback((skill: Skill) => {
    setSelectedSkill(skill);
    const level = skillLevels?.[skill];
    if (level?.cefr_level) {
      setAppState('catalog-filtered');
    } else {
      setAppState('assessment-invite');
    }
  }, [skillLevels, setSelectedSkill, setAppState]);

  const handleAssessmentStart = useCallback(async () => {
    if (!selectedSkill) return;
    const result = await startAssessmentAction(selectedSkill);
    if (result.status === 'ok') {
      setAssessmentId(result.assessment_id);
      setAssessmentResult(null);
      if (result.skill === 'listening') {
        setAssessmentListeningItems(result.items);
        setAssessmentReadingItems([]);
        setAssessmentWritingTask(null);
        setAssessmentPrompts([]);
      } else if (result.skill === 'reading') {
        setAssessmentReadingItems(result.items);
        setAssessmentListeningItems([]);
        setAssessmentWritingTask(null);
        setAssessmentPrompts([]);
      } else if (result.skill === 'writing') {
        setAssessmentWritingTask(result.task);
        setAssessmentListeningItems([]);
        setAssessmentReadingItems([]);
        setAssessmentPrompts([]);
      } else {
        setAssessmentPrompts(result.prompts);
        setAssessmentIsYl(result.is_yl);
        setAssessmentListeningItems([]);
        setAssessmentReadingItems([]);
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
      const result = await applyDefaultSkillLevelAction(selectedSkill, level);
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
    assessmentListeningItems,
    assessmentReadingItems,
    assessmentWritingTask,
    assessmentResult,
    setAssessmentResult,
    handleSkillSelect,
    handleAssessmentStart,
    handleResetSkillLevel,
    handlePickLevel,
  };
}
