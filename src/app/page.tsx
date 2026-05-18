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
import type { PracticeMode } from '@/lib/types/practice';
import type { StoredMessage } from '@/actions/messages';

export default function App() {
  const t = useTranslations('home.bobUnavailable');
  const [appState, setAppState] = useState<AppState>('mode-selection');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const { organization, enabledModes, availableModes, cefrActiveLevel, cefrLevelLocked, setCefrActiveLevel, loading: orgLoading, accessDenialReason } = useOrganization();

  const cefrSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? undefined);
    });
  }, []);

  const [mode, setMode] = useState<PracticeMode>(null);
  const [topic, setTopic] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarCollapsed(true);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
    handleNewSession(resetToModeSelection);
  }, [handleNewSession, resetToModeSelection]);

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
    await handleDeleteSession(id, activeSessionId, resetToModeSelection);
  }, [handleDeleteSession, activeSessionId, resetToModeSelection]);

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

  const onConversationSessionStart = useCallback((t: string) => {
    setTopic(t);
    handleConversationSessionStart(t);
  }, [handleConversationSessionStart]);

  const onFinish = useCallback(() => {
    setSelectedMessages([]);
    setSelectedSession(null);
    resetToModeSelection();
  }, [resetToModeSelection, setSelectedMessages, setSelectedSession]);

  const handleBannerScroll = useCallback(() => {
    cefrSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

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
    onBack: () => setAppState('mode-selection'),
  };

  return (
    <div className="h-screen bg-trebol-bg flex flex-col overflow-hidden">
      <Navbar
        userEmail={userEmail}
        onOpenDashboard={() => setAppState('dashboard')}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
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
                    {showBanner && <CefrCtaBanner onScroll={handleBannerScroll} />}
                    <ModeSelection
                      ref={cefrSelectorRef}
                      onSelect={handleModeSelect}
                      enabledModes={enabledModes}
                      availableModes={availableModes}
                      cefrActiveLevel={cefrActiveLevel}
                      cefrLevelLocked={cefrLevelLocked}
                      onCefrChange={setCefrActiveLevel}
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
                    onBack={onFinish}
                    onSessionStart={async (title) => {
                      const { data } = await createSessionAction({ mode, topic: title, title });
                      if (data) { setActiveSessionId(data.id); setSessions(prev => [data, ...prev]); }
                      return data?.id;
                    }}
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
                  onBack={() => setAppState('mode-selection')}
                  onAfterReset={() => {
                    void refreshSessions();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

        </main>
      </div>
    </div>
  );
}
