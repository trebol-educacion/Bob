'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import { ModeSelection } from '@/components/ModeSelection';
import { ConversationPractice } from '@/components/ConversationPractice';
import { SessionSidebar } from '@/components/SessionSidebar';
import { BobPracticeChat } from '@/components/BobPracticeChat';
import { CefrCtaBanner } from '@/components/CefrCtaBanner';
import { BobAccessDenied } from '@/components/BobAccessDenied';
import { StudentStatsPanel } from '@/components/StudentStatsPanel';
import { ChallengeHome } from '@/components/challenge/ChallengeHome';
import { ChallengeRunner } from '@/components/challenge/ChallengeRunner';
import { SkillSelector } from '@/components/assessment/SkillSelector';
import { AssessmentInvite } from '@/components/assessment/AssessmentInvite';
import { AssessmentSpeakingRunner } from '@/components/assessment/AssessmentSpeakingRunner';
import { AssessmentListeningRunner } from '@/components/assessment/AssessmentListeningRunner';
import { AssessmentReadingRunner } from '@/components/assessment/AssessmentReadingRunner';
import { AssessmentWritingRunner } from '@/components/assessment/AssessmentWritingRunner';
import { AssessmentResultCard } from '@/components/assessment/AssessmentResultCard';
import { startAssessmentAction } from '@/actions/assessment';
import { applyDefaultSkillLevelAction, promoteSkillLevelAction, resetOwnSkillLevelAction } from '@/actions/skills';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { Navbar } from '@/components/Navbar';
import { useSessionState } from '@/hooks/useSessionState';
import { useOrganization } from '@/hooks/useOrganization';
import {
  getRouteForMode,
  isExamMode,
  isConversationMode,
  isFceImageMode,
  type AppState,
  type YLRenderProps,
  type ExamRenderProps,
} from '@/lib/routing';
import type { PracticeMode, CefrLevel } from '@/lib/types/practice';
import type { StoredMessage } from '@/actions/messages';
import type { Skill } from '@/lib/types/skills';
import type { AssessmentResultSpeaking, AssessmentResultListening, AssessmentResultReading, AssessmentResultWriting } from '@/lib/types/skills';
import type { AssessmentPrompt, AssessmentListeningItem, AssessmentReadingItem, AssessmentWritingTask } from '@/actions/assessment';

export default function App() {
  const t = useTranslations('home.bobUnavailable');
  const [appState, setAppState] = useState<AppState>('skill-selection');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const {
    organization,
    enabledModes,
    availableModes,
    cefrActiveLevel,
    cefrLevelLocked,
    setCefrActiveLevel,
    loading: orgLoading,
    accessDenialReason,
    skillLevels,
    selectedSkill,
    setSelectedSkill,
    refreshSkillLevels,
    refreshPendingAssessments,
    sustainedImprovementDetected,
    checkSustainedImprovement,
  } = useOrganization();

  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [assessmentPrompts, setAssessmentPrompts] = useState<AssessmentPrompt[]>([]);
  const [assessmentIsYl, setAssessmentIsYl] = useState(false);
  const [assessmentListeningItems, setAssessmentListeningItems] = useState<AssessmentListeningItem[]>([]);
  const [assessmentReadingItems, setAssessmentReadingItems] = useState<AssessmentReadingItem[]>([]);
  const [assessmentWritingTask, setAssessmentWritingTask] = useState<AssessmentWritingTask | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResultSpeaking | AssessmentResultListening | AssessmentResultReading | AssessmentResultWriting | null>(null);

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

  const resetToModeSelection = useCallback(() => {
    setAppState('mode-selection');
    setMode(null);
    setTopic('');
  }, []);

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

  const handleYLSessionCreated = useCallback(
    (newSessionId: string) => {
      setActiveSessionId(newSessionId);
      void refreshSessions();
    },
    [setActiveSessionId, refreshSessions]
  );

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

  const handleModeSelect = (m: PracticeMode) => {
    setMode(m);
    if (isConversationMode(m ?? '')) {
      setAppState('conversation-practicing');
    } else if (m !== null && isExamMode(m)) {
      setAppState('exam-practicing');
    } else {
      setAppState('practicing');
    }
  };

  const onConversationSessionStart = useCallback((topicStr: string) => {
    setTopic(topicStr);
    handleConversationSessionStart(topicStr);
  }, [handleConversationSessionStart]);

  const onFinish = useCallback(() => {
    setSelectedMessages([]);
    setSelectedSession(null);
    resetToSkillSelection();
  }, [resetToSkillSelection, setSelectedMessages, setSelectedSession]);

  const handleBannerScroll = useCallback(() => {
    cefrSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const handleSkillSelect = useCallback((skill: Skill) => {
    setSelectedSkill(skill);
    const level = skillLevels?.[skill];
    if (level?.cefr_level) {
      setAppState('catalog-filtered');
    } else {
      setAppState('assessment-invite');
    }
  }, [skillLevels, setSelectedSkill]);

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
    } else if (result.status === 'cooldown') {
      setAppState('assessment-invite');
    } else {
      setAppState('assessment-invite');
    }
  }, [selectedSkill]);

  const handleResetSkillLevel = useCallback(async () => {
    if (!selectedSkill) return;
    const result = await resetOwnSkillLevelAction(selectedSkill);
    if (result.ok) {
      await refreshSkillLevels();
      setAppState('assessment-invite');
    }
  }, [selectedSkill, refreshSkillLevels]);

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
  }, [selectedSkill, skillLevels, refreshSkillLevels]);

  const showBanner = cefrActiveLevel === null && !cefrLevelLocked;

  if (!orgLoading && accessDenialReason) {
    return <BobAccessDenied reason={accessDenialReason} />;
  }

  const ylProps: YLRenderProps = {
    onBack: onFinish,
    sessionId: activeSessionId ?? undefined,
    initialMessages: selectedMessages.length > 0 ? selectedMessages : undefined,
    onSessionCreated: handleYLSessionCreated,
    onSessionFinished: refreshSessions,
    onOpenDashboard: () => setAppState('dashboard'),
  };

  const examProps: ExamRenderProps = {
    onBack: () => setAppState('catalog-filtered'),
  };

  return (
    <div className="h-screen bg-trebol-bg flex flex-col overflow-hidden">
      <Navbar
        userEmail={userEmail}
        onOpenDashboard={() => setAppState('dashboard')}
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
                <div className="px-4 pt-4">
                  <button
                    onClick={() => setAppState('skill-selection')}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium mb-2"
                  >
                    ← Back
                  </button>
                  {sustainedImprovementDetected === true && selectedSkill && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-green-50 border border-green-200 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-black text-green-800">Ready to level up?</p>
                        <p className="text-xs text-green-600 font-medium mt-0.5">
                          Your recent sessions show strong accuracy. Take an Assessment to confirm your next level.
                        </p>
                      </div>
                      <button
                        onClick={() => setAppState('assessment-invite')}
                        className="shrink-0 px-3 py-1.5 rounded-xl bg-green-600 text-white text-xs font-black hover:bg-green-700 transition-colors shadow-sm"
                      >
                        Take Assessment
                      </button>
                    </motion.div>
                  )}
                </div>
                <ModeSelection
                  ref={cefrSelectorRef}
                  onSelect={handleModeSelect}
                  enabledModes={enabledModes}
                  availableModes={availableModes}
                  cefrActiveLevel={(selectedSkill ? skillLevels?.[selectedSkill]?.cefr_level : null) ?? cefrActiveLevel}
                  cefrLevelLocked={cefrLevelLocked}
                  organizationName={organization?.name}
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
                  <>
                    <ModeSelection
                      ref={cefrSelectorRef}
                      onSelect={handleModeSelect}
                      enabledModes={enabledModes}
                      availableModes={availableModes}
                      cefrActiveLevel={(selectedSkill ? skillLevels?.[selectedSkill]?.cefr_level : null) ?? cefrActiveLevel}
                      cefrLevelLocked={cefrLevelLocked}
                      organizationName={organization?.name}
                    />
                  </>
                )}
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
                {isFceImageMode(mode) ? (
                  <BobPracticeChat
                    mode="image"
                    level="b2"
                    onBack={onFinish}
                    onSessionStart={async (title) => {
                      const { data } = await createSessionAction({ mode: 'generic_image', topic: title, title });
                      if (data) { setActiveSessionId(data.id); setSessions(prev => [data, ...prev]); }
                      return data?.id;
                    }}
                    sessionId={activeSessionId}
                    initialMessages={selectedMessages.length > 0 ? selectedMessages : undefined}
                  />
                ) : (
                  <BobPracticeChat
                    mode={mode === 'generic_image' ? 'image' : 'situation'}
                    level={(cefrActiveLevel as 'a1' | 'a2' | 'b1' | 'b2' | undefined) ?? undefined}
                    onBack={onFinish}
                    onSessionStart={async (title) => {
                      const { data } = await createSessionAction({ mode, topic: title, title });
                      if (data) { setActiveSessionId(data.id); setSessions(prev => [data, ...prev]); }
                      return data?.id;
                    }}
                    onSessionFinished={refreshSessions}
                    sessionId={activeSessionId}
                    initialMessages={selectedMessages.length > 0 ? selectedMessages : undefined}
                  />
                )}
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
                <StudentStatsPanel
                  onBack={() => setAppState('skill-selection')}
                  onAfterReset={() => {
                    void refreshSessions();
                  }}
                  onTakeAssessment={(skill) => {
                    setSelectedSkill(skill);
                    setAppState('assessment-invite');
                  }}
                  onChangeLevel={async (skill, level) => {
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
