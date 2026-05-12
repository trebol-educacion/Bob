'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ModeSelection } from '@/components/ModeSelection';
import { ConversationPractice } from '@/components/ConversationPractice';
import { SessionSidebar } from '@/components/SessionSidebar';
import { BobPracticeChat } from '@/components/BobPracticeChat';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { Navbar } from '@/components/Navbar';
import { useSessionState } from '@/hooks/useSessionState';
import { useOrganization } from '@/hooks/useOrganization';
import { B1CollaborativePractice } from '@/components/B1CollaborativePractice';
import { A2Part1Practice } from '@/components/A2Part1Practice';
import { ToeflListenRepeatPractice } from '@/components/ToeflListenRepeatPractice';
import { ToeflInterviewPractice } from '@/components/ToeflInterviewPractice';
import type { PracticeMode } from '@/lib/types/practice';

type AppState =
  | 'mode-selection'
  | 'practicing'
  | 'conversation-practicing'
  | 'exam-practicing';

export default function App() {
  const [appState, setAppState] = useState<AppState>('mode-selection');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const { organization } = useOrganization();

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? undefined);
    });
  }, []);

  const [mode, setMode] = useState<PracticeMode>(null);
  const [topic, setTopic] = useState('');

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
  } = useSessionState(userEmail);

  const onNewSession = useCallback(() => {
    handleNewSession(resetToModeSelection);
  }, [handleNewSession, resetToModeSelection]);

  const onSelectSession = useCallback(async (id: string) => {
    await handleSelectSession(id, (sessionMode, sessionTopic) => {
      setMode(sessionMode as PracticeMode);
      if (sessionMode === 'conversation') {
        setTopic(sessionTopic);
        setAppState('conversation-practicing');
      } else if (
        sessionMode === 'b1_collaborative' ||
        sessionMode === 'a2_part1' ||
        sessionMode === 'toefl_listen_repeat' ||
        sessionMode === 'toefl_interview'
      ) {
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
    if (m === 'conversation') {
      setAppState('conversation-practicing');
    } else if (
      m === 'b1_collaborative' ||
      m === 'a2_part1' ||
      m === 'toefl_listen_repeat' ||
      m === 'toefl_interview'
    ) {
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

  return (
    <div className="h-screen bg-trebol-bg flex flex-col overflow-hidden">
      <Navbar userEmail={userEmail} />
      <div className="flex-1 flex min-h-0">
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={onSelectSession}
          onNewSession={onNewSession}
          onDeleteSession={onDeleteSession}
          loading={sessionsLoading}
        />
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">

          <AnimatePresence mode="wait">
            {appState === 'mode-selection' && (
              <motion.div
                key="mode-selection"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-4xl mx-auto flex-1 flex flex-col items-center py-8 px-4 overflow-y-auto"
              >
                {organization && (
                  <p className="text-sm text-trebol-text/50 mb-4 text-center">{organization.name}</p>
                )}
                <ModeSelection onSelect={handleModeSelect} />
              </motion.div>
            )}


            {appState === 'practicing' && mode && mode !== 'conversation' && (
              <motion.div
                key={`practicing-${mode}-${selectedMessages.length > 0 ? activeSessionId : 'new'}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col min-h-0"
              >
                {mode === 'b2_speaking' ? (
                  <BobPracticeChat
                    mode="image"
                    level="b2"
                    onBack={onFinish}
                    onSessionStart={async (title) => {
                      const { data } = await createSessionAction({ mode: 'image', topic: title, title });
                      if (data) { setActiveSessionId(data.id); setSessions(prev => [data, ...prev]); }
                      return data?.id;
                    }}
                    sessionId={activeSessionId}
                    initialMessages={selectedMessages.length > 0 ? selectedMessages : undefined}
                  />
                ) : (
                  <BobPracticeChat
                    mode={mode as 'situation' | 'image'}
                    onBack={onFinish}
                    onSessionStart={async (title) => {
                      const { data } = await createSessionAction({ mode: mode as 'situation' | 'image', topic: title, title });
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
                key={`exam-practicing-${mode}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col min-h-0"
              >
                {mode === 'b1_collaborative' && (
                  <B1CollaborativePractice onBack={() => setAppState('mode-selection')} />
                )}
                {mode === 'a2_part1' && (
                  <A2Part1Practice onBack={() => setAppState('mode-selection')} />
                )}
                {mode === 'toefl_listen_repeat' && (
                  <ToeflListenRepeatPractice onBack={() => setAppState('mode-selection')} />
                )}
                {mode === 'toefl_interview' && (
                  <ToeflInterviewPractice onBack={() => setAppState('mode-selection')} />
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </main>
      </div>
    </div>
  );
}
