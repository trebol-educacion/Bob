'use client';

import React, { useCallback, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { SessionSidebar } from '@/components/SessionSidebar';
import { ConfirmLeaveDialog } from '@/components/assessment/ConfirmLeaveDialog';
import { AppShellRoutes } from './AppShellRoutes';
import type { BobSession } from '@/actions/sessions';
import type { StoredMessage } from '@/actions/messages';
import type { AssessmentPrompt, AssessmentListeningItem, AssessmentReadingItem, AssessmentWritingTask } from '@/actions/assessment';
import type { AppState } from '@/lib/routing';
import { useOrganization, type AvailableMode } from '@/contexts/OrganizationContext';
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
  leavePractice: (target: AppState) => void;
  onSelectExam: () => void;
  onSelectPractice: () => void;
  handleSkillSelect: (skill: Skill) => void;
  setSelectedSkill: (skill: Skill | null) => void;
  handleModeSelect: (m: PracticeMode) => void;
  handleAssessmentStart: () => void;
  handlePickLevel: (level: CefrLevel) => void;
  onConversationSessionStart: (topic: string) => void;
  refreshSessions: () => void;
  refreshSkillLevels: () => Promise<void>;
  refreshPendingAssessments: () => Promise<void>;
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
  leavePractice,
  onSelectExam,
  onSelectPractice,
  handleSkillSelect,
  setSelectedSkill,
  handleModeSelect,
  handleAssessmentStart,
  handlePickLevel,
  onConversationSessionStart,
  refreshSessions,
  refreshSkillLevels,
  refreshPendingAssessments,
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
  const { track, setTrack } = useOrganization();

  const [pendingLeaveAction, setPendingLeaveAction] = useState<(() => void) | null>(null);

  const requestLeaveConfirmation = useCallback((action: () => void) => {
    setPendingLeaveAction(() => action);
  }, []);

  const confirmLeave = useCallback(() => {
    pendingLeaveAction?.();
    setPendingLeaveAction(null);
  }, [pendingLeaveAction]);

  const dismissLeaveConfirmation = useCallback(() => setPendingLeaveAction(null), []);

  const onOpenDashboard = useCallback(() => setAppState('dashboard'), [setAppState]);

  const handleGoHomeRequest = useCallback(() => {
    if (appState === 'assessment-running') {
      requestLeaveConfirmation(onFinish);
    } else {
      onFinish();
    }
  }, [appState, onFinish, requestLeaveConfirmation]);

  const placementRequired = appState === 'placement-required';

  return (
    <div className="h-screen bg-trebol-bg flex flex-col overflow-hidden">
      <Navbar
        userEmail={userEmail}
        onOpenDashboard={placementRequired ? undefined : onOpenDashboard}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        onGoHome={placementRequired ? undefined : handleGoHomeRequest}
      />
      <ConfirmLeaveDialog
        open={pendingLeaveAction !== null}
        onConfirm={confirmLeave}
        onDismiss={dismissLeaveConfirmation}
      />
      <div className="flex-1 flex min-h-0 relative">
        {!placementRequired && (
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
        )}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <AppShellRoutes
            appState={appState}
            setAppState={setAppState}
            mode={mode}
            topic={topic}
            organization={organization}
            enabledModes={enabledModes}
            availableModes={availableModes}
            cefrActiveLevel={cefrActiveLevel}
            cefrLevelLocked={cefrLevelLocked}
            skillLevels={skillLevels}
            selectedSkill={selectedSkill}
            sustainedImprovementDetected={sustainedImprovementDetected}
            activeSessionId={activeSessionId}
            selectedMessages={selectedMessages}
            onFinish={onFinish}
            leavePractice={leavePractice}
            onSelectExam={onSelectExam}
            onSelectPractice={onSelectPractice}
            handleSkillSelect={handleSkillSelect}
            setSelectedSkill={setSelectedSkill}
            handleModeSelect={handleModeSelect}
            handleAssessmentStart={handleAssessmentStart}
            handlePickLevel={handlePickLevel}
            onConversationSessionStart={onConversationSessionStart}
            refreshSessions={refreshSessions}
            refreshSkillLevels={refreshSkillLevels}
            refreshPendingAssessments={refreshPendingAssessments}
            requestLeaveConfirmation={requestLeaveConfirmation}
            setActiveSessionId={setActiveSessionId}
            setSessions={setSessions}
            cefrSelectorRef={cefrSelectorRef}
            assessmentId={assessmentId}
            assessmentPrompts={assessmentPrompts}
            assessmentIsYl={assessmentIsYl}
            assessmentListeningItems={assessmentListeningItems}
            assessmentReadingItems={assessmentReadingItems}
            assessmentWritingTask={assessmentWritingTask}
            assessmentResult={assessmentResult}
            setAssessmentResult={setAssessmentResult}
            track={track}
            setTrack={setTrack}
          />
        </main>
      </div>
    </div>
  );
}
