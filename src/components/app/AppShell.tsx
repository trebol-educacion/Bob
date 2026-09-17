'use client';

import React, { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar } from '@/components/Navbar';
import { SessionSidebar } from '@/components/SessionSidebar';
import { SkillSelector } from '@/components/assessment/SkillSelector';
import { AssessmentInvite } from '@/components/assessment/AssessmentInvite';
import { AssessmentSpeakingRunner } from '@/components/assessment/AssessmentSpeakingRunner';
import { AssessmentListeningRunner } from '@/components/assessment/AssessmentListeningRunner';
import { AssessmentReadingRunner } from '@/components/assessment/AssessmentReadingRunner';
import { AssessmentWritingRunner } from '@/components/assessment/AssessmentWritingRunner';
import { AssessmentResultCard } from '@/components/assessment/AssessmentResultCard';
import { ConversationPractice } from '@/components/ConversationPractice';
import { ChallengeHome } from '@/components/challenge/ChallengeHome';
import { ChallengeRunner } from '@/components/challenge/ChallengeRunner';
import { CatalogView } from './views/CatalogView';
import { ModeSelectorView } from './views/ModeSelectorView';
import { PracticeView } from './views/PracticeView';
import { DashboardView } from './views/DashboardView';
import type { BobSession } from '@/actions/sessions';
import type { StoredMessage } from '@/actions/messages';
import type { AssessmentPrompt, AssessmentListeningItem, AssessmentReadingItem, AssessmentWritingTask } from '@/actions/assessment';
import type { AppState, YLRenderProps, ExamRenderProps } from '@/lib/routing';
import { getRouteForMode, isConversationMode } from '@/lib/routing';
import type { AvailableMode } from '@/contexts/OrganizationContext';
import type { Organization } from '@/lib/organization';
import type { PracticeMode, CefrLevel, ModeKey } from '@/lib/types/practice';
import type { Skill, SkillLevelMap } from '@/lib/types/skills';
import type { AssessmentResultUnion } from '@/hooks/useAssessmentFlow';

export interface AppShellProps {
  userEmail?: string;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  mode: PracticeMode;
  topic: string;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  organization: Organization | null;
  enabledModes: ModeKey[];
  availableModes: AvailableMode[];
  cefrActiveLevel: CefrLevel | null;
  cefrLevelLocked: boolean;
  skillLevels: SkillLevelMap | null;
  selectedSkill: Skill | null;
  sustainedImprovementDetected: boolean | null;
  sessions: BobSession[];
  activeSessionId: string | null;
  sessionsLoading: boolean;
  selectedMessages: StoredMessage[];
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onFinish: () => void;
  handleSkillSelect: (skill: Skill) => void;
  setSelectedSkill: (skill: Skill | null) => void;
  handleModeSelect: (m: PracticeMode) => void;
  handleAssessmentStart: () => void;
  handlePickLevel: (level: CefrLevel) => void;
  onConversationSessionStart: (topic: string) => void;
  refreshSessions: () => void;
  refreshSkillLevels: () => Promise<void>;
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
}

export function AppShell({
  userEmail,
  appState,
  setAppState,
  mode,
  topic,
  sidebarCollapsed,
  setSidebarCollapsed,
  organization,
  enabledModes,
  availableModes,
  cefrActiveLevel,
  cefrLevelLocked,
  skillLevels,
  selectedSkill,
  sustainedImprovementDetected,
  sessions,
  activeSessionId,
  sessionsLoading,
  selectedMessages,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onFinish,
  handleSkillSelect,
  setSelectedSkill,
  handleModeSelect,
  handleAssessmentStart,
  handlePickLevel,
  onConversationSessionStart,
  refreshSessions,
  refreshSkillLevels,
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
}: AppShellProps) {
  const t = useTranslations('home.bobUnavailable');

  const onOpenDashboard = useCallback(() => setAppState('dashboard'), [setAppState]);

  const handleYLSessionCreated = useCallback((newSessionId: string) => {
    setActiveSessionId(newSessionId);
    void refreshSessions();
  }, [setActiveSessionId, refreshSessions]);

  const ylProps: YLRenderProps = {
    onBack: onFinish,
    sessionId: activeSessionId ?? undefined,
    initialMessages: selectedMessages.length > 0 ? selectedMessages : undefined,
    onSessionCreated: handleYLSessionCreated,
    onSessionFinished: refreshSessions,
    onOpenDashboard,
  };

  const examProps: ExamRenderProps = {
    onBack: () => setAppState('catalog-filtered'),
  };

  return (
    <div className="h-screen bg-trebol-bg flex flex-col overflow-hidden">
      <Navbar
        userEmail={userEmail}
        onOpenDashboard={onOpenDashboard}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        onGoHome={onFinish}
      />
      <div className="flex-1 flex min-h-0 relative">
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={onSelectSession}
          onNewSession={onNewSession}
          onDeleteSession={onDeleteSession}
          loading={sessionsLoading}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        />
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">

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

            {appState === 'assessment-invite' && selectedSkill && (
              <motion.div
                key="assessment-invite"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full flex-1 overflow-y-auto"
              >
                <AssessmentInvite
                  skill={selectedSkill}
                  onStartAssessment={handleAssessmentStart}
                  onPickLevel={handlePickLevel}
                  onBack={() => setAppState('skill-selection')}
                />
              </motion.div>
            )}

            {appState === 'assessment-running' && assessmentId && assessmentPrompts.length > 0 && (
              <motion.div
                key="assessment-running-speaking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full flex-1 flex flex-col"
              >
                <AssessmentSpeakingRunner
                  assessment_id={assessmentId}
                  prompts={assessmentPrompts}
                  is_yl={assessmentIsYl}
                  onQueued={() => setAppState('dashboard')}
                  onCancel={() => setAppState('assessment-invite')}
                />
              </motion.div>
            )}

            {appState === 'assessment-running' && assessmentId && assessmentListeningItems.length > 0 && (
              <motion.div
                key="assessment-running-listening"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full flex-1 flex flex-col"
              >
                <AssessmentListeningRunner
                  assessment_id={assessmentId}
                  items={assessmentListeningItems}
                  onResult={async (result) => {
                    setAssessmentResult(result);
                    await refreshSkillLevels();
                    setAppState('assessment-result');
                  }}
                  onCancel={() => setAppState('assessment-invite')}
                />
              </motion.div>
            )}

            {appState === 'assessment-running' && assessmentId && assessmentReadingItems.length > 0 && (
              <motion.div
                key="assessment-running-reading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full flex-1 flex flex-col"
              >
                <AssessmentReadingRunner
                  assessment_id={assessmentId}
                  items={assessmentReadingItems}
                  onResult={async (result) => {
                    setAssessmentResult(result);
                    await refreshSkillLevels();
                    setAppState('assessment-result');
                  }}
                  onCancel={() => setAppState('assessment-invite')}
                />
              </motion.div>
            )}

            {appState === 'assessment-running' && assessmentId && assessmentWritingTask && (
              <motion.div
                key="assessment-running-writing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full flex-1 flex flex-col"
              >
                <AssessmentWritingRunner
                  assessment_id={assessmentId}
                  task={assessmentWritingTask}
                  onQueued={() => setAppState('dashboard')}
                  onCancel={() => setAppState('assessment-invite')}
                />
              </motion.div>
            )}

            {appState === 'assessment-result' && assessmentResult && (
              <motion.div
                key="assessment-result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full flex-1 flex flex-col"
              >
                <AssessmentResultCard
                  result={assessmentResult}
                  onPracticeNow={() => setAppState('catalog-filtered')}
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
                  enabledModes={enabledModes}
                  availableModes={availableModes}
                  skillLevels={skillLevels}
                  cefrActiveLevel={cefrActiveLevel}
                  cefrLevelLocked={cefrLevelLocked}
                  organization={organization}
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
                key="conversation-practicing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col min-h-0"
              >
                <ConversationPractice
                  topic={selectedMessages.length > 0 ? topic : ''}
                  onFinish={onFinish}
                  noFrame={true}
                  onSessionStart={onConversationSessionStart}
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

        </main>
      </div>
    </div>
  );
}
