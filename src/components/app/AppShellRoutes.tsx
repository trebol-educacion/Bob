'use client';

import React, { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import { SkillSelector } from '@/components/assessment/SkillSelector';
import { ConversationPracticeView } from './views/ConversationPracticeView';
import { ChallengeHome } from '@/components/challenge/ChallengeHome';
import { ChallengeRunner } from '@/components/challenge/ChallengeRunner';
import { CatalogView } from './views/CatalogView';
import { ModeSelectorView } from './views/ModeSelectorView';
import { PracticeView } from './views/PracticeView';
import { DashboardView } from './views/DashboardView';
import { AssessmentView } from './views/AssessmentView';
import type { BobSession } from '@/actions/sessions';
import type { StoredMessage } from '@/actions/messages';
import type { AssessmentPrompt, AssessmentListeningItem, AssessmentReadingItem, AssessmentWritingTask } from '@/actions/assessment';
import type { AppState, YLRenderProps, ExamRenderProps } from '@/lib/routing';
import { getRouteForMode, isConversationMode } from '@/lib/routing';
import type { Organization } from '@/lib/organization';
import type { AvailableMode } from '@/lib/organization/types';
import type { PracticeMode, CefrLevel, ModeKey } from '@/lib/types/practice';
import type { Skill, SkillLevelMap } from '@/lib/types/skills';
import type { AssessmentResultUnion } from '@/hooks/useAssessmentFlow';
import type { PracticeTrack } from '@/lib/modes';

export interface AppShellRoutesProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  mode: PracticeMode;
  topic: string;
  organization: Organization | null;
  enabledModes: ModeKey[];
  availableModes: AvailableMode[];
  cefrActiveLevel: CefrLevel | null;
  cefrLevelLocked: boolean;
  skillLevels: SkillLevelMap | null;
  selectedSkill: Skill | null;
  sustainedImprovementDetected: boolean | null;
  activeSessionId: string | null;
  selectedMessages: StoredMessage[];
  onFinish: () => void;
  leavePractice: (target: AppState) => void;
  handleSkillSelect: (skill: Skill) => void;
  setSelectedSkill: (skill: Skill | null) => void;
  handleModeSelect: (m: PracticeMode) => void;
  handleAssessmentStart: () => void;
  handlePickLevel: (level: CefrLevel) => void;
  onConversationSessionStart: (topic: string) => void;
  refreshSessions: () => void;
  refreshSkillLevels: () => Promise<void>;
  refreshPendingAssessments: () => Promise<void>;
  requestLeaveConfirmation: (action: () => void) => void;
  setActiveSessionId: (id: string | null) => void;
  setSessions: React.Dispatch<React.SetStateAction<BobSession[]>>;
  cefrSelectorRef: React.RefObject<HTMLDivElement | null>;
  assessmentId: string | null;
  assessmentPrompts: AssessmentPrompt[];
  assessmentIsYl: boolean;
  assessmentListeningItems: AssessmentListeningItem[];
  assessmentReadingItems: AssessmentReadingItem[];
  assessmentWritingTask: AssessmentWritingTask | null;
  assessmentResult: AssessmentResultUnion | null;
  setAssessmentResult: (result: AssessmentResultUnion | null) => void;
  track: PracticeTrack;
  setTrack: (track: PracticeTrack) => void;
}

/** @param props AppShellRoutesProps */
export function AppShellRoutes({
  appState,
  setAppState,
  mode,
  topic,
  organization,
  enabledModes,
  availableModes,
  cefrActiveLevel,
  cefrLevelLocked,
  skillLevels,
  selectedSkill,
  sustainedImprovementDetected,
  activeSessionId,
  selectedMessages,
  onFinish,
  leavePractice,
  handleSkillSelect,
  setSelectedSkill,
  handleModeSelect,
  handleAssessmentStart,
  handlePickLevel,
  onConversationSessionStart,
  refreshSessions,
  refreshSkillLevels,
  refreshPendingAssessments,
  requestLeaveConfirmation,
  setActiveSessionId,
  setSessions,
  cefrSelectorRef,
  assessmentId,
  assessmentPrompts,
  assessmentIsYl,
  assessmentListeningItems,
  assessmentReadingItems,
  assessmentWritingTask,
  assessmentResult,
  setAssessmentResult,
  track,
  setTrack,
}: AppShellRoutesProps) {
  const t = useTranslations('home.bobUnavailable');

  const onOpenDashboard = useCallback(() => setAppState('dashboard'), [setAppState]);
  const onBackToCatalog = useCallback(() => leavePractice('catalog-filtered'), [leavePractice]);

  const handleYLSessionCreated = useCallback((newSessionId: string) => {
    setActiveSessionId(newSessionId);
    void refreshSessions();
  }, [setActiveSessionId, refreshSessions]);

  const ylProps: YLRenderProps = {
    onBack: onBackToCatalog,
    sessionId: selectedMessages.length > 0 ? activeSessionId ?? undefined : undefined,
    initialMessages: selectedMessages.length > 0 ? selectedMessages : undefined,
    onSessionCreated: handleYLSessionCreated,
    onSessionFinished: refreshSessions,
    onOpenDashboard,
  };

  const examProps: ExamRenderProps = {
    onBack: onBackToCatalog,
  };

  return (
    <AnimatePresence mode="wait">

      {appState === 'skill-selection' && (
        <motion.div
          key="skill-selection"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="w-full flex-1 overflow-y-auto"
        >
          {organization && organization.is_bob_enabled === false ? (
            <div className="w-full flex-1 flex flex-col items-center justify-center py-24 px-4 text-center">
              <div className="bg-white shadow-md rounded-2xl p-10 max-w-md w-full space-y-3">
                <p className="text-2xl font-black text-trebol-text">{t('title')}</p>
                <p className="text-trebol-text opacity-60 font-medium text-sm">
                  {t('body')}
                </p>
              </div>
            </div>
          ) : (
            <SkillSelector onSelect={handleSkillSelect} />
          )}
        </motion.div>
      )}

      {(appState === 'assessment-invite' || appState === 'assessment-running' || appState === 'assessment-result') && (
        <motion.div
          key={`assessment-${appState}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="w-full flex-1 overflow-y-auto flex flex-col"
        >
          <AssessmentView
            appState={appState}
            setAppState={setAppState}
            leavePractice={leavePractice}
            selectedSkill={selectedSkill}
            handleAssessmentStart={handleAssessmentStart}
            handlePickLevel={handlePickLevel}
            refreshSkillLevels={refreshSkillLevels}
            refreshPendingAssessments={refreshPendingAssessments}
            requestLeaveConfirmation={requestLeaveConfirmation}
            assessmentId={assessmentId}
            assessmentPrompts={assessmentPrompts}
            assessmentIsYl={assessmentIsYl}
            assessmentListeningItems={assessmentListeningItems}
            assessmentReadingItems={assessmentReadingItems}
            assessmentWritingTask={assessmentWritingTask}
            assessmentResult={assessmentResult}
            setAssessmentResult={setAssessmentResult}
          />
        </motion.div>
      )}

      {appState === 'catalog-filtered' && (
        <motion.div
          key="catalog-filtered"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="w-full flex-1 overflow-y-auto"
        >
          <CatalogView
            setAppState={setAppState}
            sustainedImprovementDetected={sustainedImprovementDetected}
            selectedSkill={selectedSkill}
            cefrSelectorRef={cefrSelectorRef}
            handleModeSelect={handleModeSelect}
            enabledModes={enabledModes} availableModes={availableModes}
            skillLevels={skillLevels}
            cefrActiveLevel={cefrActiveLevel} cefrLevelLocked={cefrLevelLocked}
            organization={organization}
            track={track} setTrack={setTrack}
          />
        </motion.div>
      )}

      {appState === 'mode-selection' && (
        <motion.div
          key="mode-selection"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="w-full flex-1 overflow-y-auto"
        >
          <ModeSelectorView
            organization={organization}
            cefrSelectorRef={cefrSelectorRef}
            handleModeSelect={handleModeSelect}
            enabledModes={enabledModes}
            availableModes={availableModes}
            skillLevels={skillLevels}
            selectedSkill={selectedSkill}
            cefrActiveLevel={cefrActiveLevel}
            cefrLevelLocked={cefrLevelLocked}
          />
        </motion.div>
      )}

      {appState === 'practicing' && mode && !isConversationMode(mode) && (
        <motion.div
          key={`practicing-${mode}-${selectedMessages.length > 0 ? activeSessionId : 'new'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex flex-col min-h-0"
        >
          <PracticeView
            mode={mode}
            onFinish={onFinish}
            cefrActiveLevel={cefrActiveLevel}
            skillLevels={skillLevels}
            selectedSkill={selectedSkill}
            activeSessionId={activeSessionId}
            selectedMessages={selectedMessages}
            setActiveSessionId={setActiveSessionId}
            setSessions={setSessions}
            refreshSessions={refreshSessions}
          />
        </motion.div>
      )}

      {appState === 'conversation-practicing' && (
        <motion.div
          key={`conversation-practicing-${selectedMessages.length > 0 ? activeSessionId : 'new'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex flex-col min-h-0"
        >
          <ConversationPracticeView
            topic={topic}
            selectedMessages={selectedMessages} activeSessionId={activeSessionId}
            skillLevels={skillLevels} cefrActiveLevel={cefrActiveLevel}
            onFinish={onFinish}
            onConversationSessionStart={onConversationSessionStart}
          />
        </motion.div>
      )}

      {appState === 'exam-practicing' && mode && (
        <motion.div
          key={`exam-practicing-${mode}-${selectedMessages.length > 0 ? activeSessionId : 'new'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex flex-col min-h-0"
        >
          {getRouteForMode(mode)?.render(
            getRouteForMode(mode)?.kind === 'yl' ? ylProps : examProps
          )}
        </motion.div>
      )}

      {appState === 'dashboard' && (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex flex-col min-h-0"
        >
          <DashboardView
            setAppState={setAppState}
            setSelectedSkill={setSelectedSkill}
            refreshSessions={refreshSessions}
            refreshSkillLevels={refreshSkillLevels}
          />
        </motion.div>
      )}

      {appState === 'challenge' && (
        <motion.div
          key="challenge"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex flex-col min-h-0"
        >
          <ChallengeHome
            onSelectFramework={() => setAppState('challenge-running')}
            onBack={() => setAppState('dashboard')}
          />
        </motion.div>
      )}

      {appState === 'challenge-running' && (
        <motion.div
          key="challenge-running"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex flex-col min-h-0"
        >
          <ChallengeRunner onExit={() => setAppState('dashboard')} />
        </motion.div>
      )}

    </AnimatePresence>
  );
}
