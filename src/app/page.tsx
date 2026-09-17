'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BobAccessDenied } from '@/components/BobAccessDenied';
import { AppShell } from '@/components/app/AppShell';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { useSessionState } from '@/hooks/useSessionState';
import { useOrganization } from '@/hooks/useOrganization';
import { useAssessmentFlow } from '@/hooks/useAssessmentFlow';
import { isConversationMode, isExamMode, type AppState } from '@/lib/routing';
import type { PracticeMode } from '@/lib/types/practice';

export default function App() {
  const [appState, setAppState] = useState<AppState>('skill-selection');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const {
    organization,
    enabledModes,
    availableModes,
    cefrActiveLevel,
    cefrLevelLocked,
    loading: orgLoading,
    accessDenialReason,
    skillLevels,
    selectedSkill,
    setSelectedSkill,
    refreshSkillLevels,
    sustainedImprovementDetected,
    checkSustainedImprovement,
  } = useOrganization();

  const cefrSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? undefined);
    });
  }, []);

  const [mode, setMode] = useState<PracticeMode>(null);
  const [topic, setTopic] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    if (mq.matches) setSidebarCollapsed(true);
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarCollapsed(true);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (appState === 'catalog-filtered') {
      checkSustainedImprovement();
    }
  }, [appState, checkSustainedImprovement]);

  const resetToSkillSelection = useCallback(() => {
    setAppState('skill-selection');
    setSelectedSkill(null);
    setMode(null);
    setTopic('');
  }, [setSelectedSkill]);

  const {
    sessions,
    activeSessionId,
    sessionsLoading,
    selectedMessages,
    setSessions,
    setActiveSessionId,
    setSelectedMessages,
    setSelectedSession,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
    handleConversationSessionStart,
    refreshSessions,
  } = useSessionState(userEmail);

  const onNewSession = useCallback(() => {
    handleNewSession(resetToSkillSelection);
  }, [handleNewSession, resetToSkillSelection]);

  const onSelectSession = useCallback(async (id: string) => {
    await handleSelectSession(id, (sessionMode, sessionTopic) => {
      setMode(sessionMode as PracticeMode);
      if (isConversationMode(sessionMode)) {
        setTopic(sessionTopic);
        setAppState('conversation-practicing');
      } else if (isExamMode(sessionMode)) {
        setAppState('exam-practicing');
      } else {
        setAppState('practicing');
      }
    });
  }, [handleSelectSession]);

  const onDeleteSession = useCallback(async (id: string) => {
    await handleDeleteSession(id, activeSessionId, resetToSkillSelection);
  }, [handleDeleteSession, activeSessionId, resetToSkillSelection]);

  const handleModeSelect = useCallback((m: PracticeMode) => {
    setMode(m);
    if (isConversationMode(m ?? '')) {
      setAppState('conversation-practicing');
    } else if (m !== null && isExamMode(m)) {
      setAppState('exam-practicing');
    } else {
      setAppState('practicing');
    }
  }, []);

  const onConversationSessionStart = useCallback((topicStr: string) => {
    setTopic(topicStr);
    handleConversationSessionStart(topicStr);
  }, [handleConversationSessionStart]);

  const onFinish = useCallback(() => {
    setSelectedMessages([]);
    setSelectedSession(null);
    resetToSkillSelection();
  }, [resetToSkillSelection, setSelectedMessages, setSelectedSession]);

  const assessment = useAssessmentFlow({
    selectedSkill,
    setSelectedSkill,
    skillLevels,
    refreshSkillLevels,
    setAppState,
  });

  if (!orgLoading && accessDenialReason) {
    return <BobAccessDenied reason={accessDenialReason} />;
  }

  return (
    <AppShell
      userEmail={userEmail}
      appState={appState}
      setAppState={setAppState}
      mode={mode}
      topic={topic}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      organization={organization}
      enabledModes={enabledModes}
      availableModes={availableModes}
      cefrActiveLevel={cefrActiveLevel}
      cefrLevelLocked={cefrLevelLocked}
      skillLevels={skillLevels}
      selectedSkill={selectedSkill}
      setSelectedSkill={setSelectedSkill}
      sustainedImprovementDetected={sustainedImprovementDetected}
      sessions={sessions}
      activeSessionId={activeSessionId}
      sessionsLoading={sessionsLoading}
      selectedMessages={selectedMessages}
      onSelectSession={onSelectSession}
      onNewSession={onNewSession}
      onDeleteSession={onDeleteSession}
      onFinish={onFinish}
      handleSkillSelect={assessment.handleSkillSelect}
      handleModeSelect={handleModeSelect}
      handleAssessmentStart={assessment.handleAssessmentStart}
      handlePickLevel={assessment.handlePickLevel}
      onConversationSessionStart={onConversationSessionStart}
      refreshSessions={refreshSessions}
      refreshSkillLevels={refreshSkillLevels}
      setActiveSessionId={setActiveSessionId}
      setSessions={setSessions}
      cefrSelectorRef={cefrSelectorRef}
      assessmentId={assessment.assessmentId}
      assessmentPrompts={assessment.assessmentPrompts}
      assessmentIsYl={assessment.assessmentIsYl}
      assessmentListeningItems={assessment.assessmentListeningItems}
      assessmentReadingItems={assessment.assessmentReadingItems}
      assessmentWritingTask={assessment.assessmentWritingTask}
      assessmentResult={assessment.assessmentResult}
      setAssessmentResult={assessment.setAssessmentResult}
    />
  );
}
