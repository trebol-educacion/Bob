'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ModeSelection } from '@/components/ModeSelection';
import { ConversationPractice } from '@/components/ConversationPractice';
import { SessionSidebar } from '@/components/SessionSidebar';
import { BobPracticeChat } from '@/components/BobPracticeChat';
import { createSessionAction, getSessionsAction, deleteSessionAction, BobSession } from '@/actions/sessions';
import { getMessagesAction, StoredMessage } from '@/actions/messages';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { Navbar } from '@/components/Navbar';

type AppState =
  | 'mode-selection'
  | 'practicing'
  | 'conversation-practicing';

export default function App() {
  const [appState, setAppState] = useState<AppState>('mode-selection');
  const [userEmail, setUserEmail] = useState<string | undefined>();

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? undefined);
    });
  }, []);

  const [sessions, setSessions] = useState<BobSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<BobSession | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<StoredMessage[]>([]);

  useEffect(() => {
    if (!userEmail) return;
    let cancelled = false;
    getSessionsAction().then(({ data }) => {
      if (cancelled) return;
      setSessions(data ?? []);
      setSessionsLoading(false);
    });
    return () => { cancelled = true; };
  }, [userEmail]);

  const [mode, setMode] = useState<'situation' | 'image' | 'conversation' | null>(null);
  const [topic, setTopic] = useState('');

  const resetToModeSelection = useCallback(() => {
    setAppState('mode-selection');
    setMode(null);
    setTopic('');
    setSelectedMessages([]);
    setSelectedSession(null);
  }, []);

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setSelectedMessages([]);
    setSelectedSession(null);
    resetToModeSelection();
  }, [resetToModeSelection]);

  const handleSelectSession = useCallback(async (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    setActiveSessionId(id);
    setSelectedSession(session);
    const { data } = await getMessagesAction(id);
    setSelectedMessages(data ?? []);
    setMode(session.mode as 'situation' | 'image' | 'conversation');
    if (session.mode === 'conversation') {
      setTopic(session.topic ?? '');
      setAppState('conversation-practicing');
    } else {
      setAppState('practicing');
    }
  }, [sessions]);

  const handleDeleteSession = useCallback(async (id: string) => {
    const snapshot = sessions;
    setSessions(s => s.filter(x => x.id !== id));
    if (activeSessionId === id) { setActiveSessionId(null); resetToModeSelection(); }
    const { error } = await deleteSessionAction(id);
    if (error) { console.error('deleteSessionAction:', error); setSessions(snapshot); }
  }, [sessions, activeSessionId, resetToModeSelection]);

  const handleModeSelect = (m: 'situation' | 'image' | 'conversation') => {
    setMode(m);
    setAppState(m === 'conversation' ? 'conversation-practicing' : 'practicing');
  };

  const handleConversationSessionStart = useCallback((t: string) => {
    setTopic(t);
    createSessionAction({ mode: 'conversation', topic: t, title: t.slice(0, 60) || 'Conversación' })
      .then(({ data }) => {
        if (data) { setActiveSessionId(data.id); setSessions(prev => [data, ...prev]); }
      });
  }, []);

  return (
    <div className="h-screen bg-trebol-bg flex flex-col overflow-hidden">
      <Navbar userEmail={userEmail} />
      <div className="flex-1 flex min-h-0">
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
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
                  onBack={resetToModeSelection}
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
                  onFinish={resetToModeSelection}
                  noFrame={true}
                  onSessionStart={handleConversationSessionStart}
                />
              </motion.div>
            )}
          </AnimatePresence>

        </main>
      </div>
    </div>
  );
}
