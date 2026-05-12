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

type AppState =
  | 'mode-selection'
  | 'practicing'
  | 'conversation-practicing';

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

  const [mode, setMode] = useState<'situation' | 'image' | 'conversation' | null>(null);
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
      setMode(sessionMode as 'situation' | 'image' | 'conversation');
      if (sessionMode === 'conversation') {
        setTopic(sessionTopic);
        setAppState('conversation-practicing');
      } else {
        setAppState('practicing');
      }
    });
  }, [handleSelectSession]);

  const onDeleteSession = useCallback(async (id: string) => {
    await handleDeleteSession(id, activeSessionId, resetToModeSelection);
  }, [handleDeleteSession, activeSessionId, resetToModeSelection]);

  const handleModeSelect = (m: 'situation' | 'image' | 'conversation') => {
    setMode(m);
    setAppState(m === 'conversation' ? 'conversation-practicing' : 'practicing');
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
                className="w-full max-w-4xl mx-auto flex-1 flex flex-col justify-center items-center py-8 px-4"
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
          </AnimatePresence>

        </main>
      </div>
    </div>
  );
}
