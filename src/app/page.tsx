'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/Button';
import { ModeSelection } from '@/components/ModeSelection';
import { ConversationPractice } from '@/components/ConversationPractice';
import { SessionSidebar } from '@/components/SessionSidebar';
import { BobPracticeChat } from '@/components/BobPracticeChat';
import { createSessionAction, getSessionsAction, deleteSessionAction, BobSession } from '@/actions/sessions';
import { getMessagesAction, StoredMessage } from '@/actions/messages';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { Sparkles, Send } from 'lucide-react';
import { Navbar } from '@/components/Navbar';

type AppState =
  | 'mode-selection'
  | 'topic-selection'
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
    if (m === 'conversation') {
      setAppState('topic-selection');
    } else {
      setAppState('practicing');
    }
  };

  const handleTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setAppState('conversation-practicing');
    createSessionAction({ mode: 'conversation', topic, title: topic.trim().slice(0, 60) || 'Conversación' })
      .then(({ data }) => {
        if (data) { setActiveSessionId(data.id); setSessions(prev => [data, ...prev]); }
      });
  };

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

            {appState === 'topic-selection' && (
              <motion.div
                key="topic-selection"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center items-center py-8 px-4 space-y-6"
              >
                <div className="text-center space-y-2">
                  <Sparkles size={48} className="text-trebol-secondary mx-auto" />
                  <h2 className="text-2xl font-black text-trebol-text">¿Qué quieres practicar?</h2>
                  <p className="text-trebol-text font-semibold opacity-60">
                    Ej: &quot;En una entrevista de trabajo&quot; o &quot;Programando en equipo&quot;.
                  </p>
                </div>
                <form onSubmit={handleTopicSubmit} className="w-full space-y-4">
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Escribe aquí tu situación..."
                    className="w-full p-4 text-lg border-2 border-trebol-border rounded-sm focus:border-trebol-primary focus:outline-none min-h-[120px] font-medium bg-white"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full flex items-center justify-center space-x-2 py-4 text-xl"
                    disabled={!topic.trim()}
                  >
                    <span>Generar Lección</span>
                    <Send size={20} />
                  </Button>
                </form>
              </motion.div>
            )}

            {appState === 'practicing' && mode && mode !== 'conversation' && (
              <motion.div
                key={`practicing-${mode}-${activeSessionId ?? 'new'}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col min-h-0"
              >
                <BobPracticeChat
                  mode={mode as 'situation' | 'image'}
                  onBack={resetToModeSelection}
                  onSessionStart={(title) => {
                    createSessionAction({ mode: mode as 'situation' | 'image', topic: title, title })
                      .then(({ data }) => {
                        if (data) { setActiveSessionId(data.id); setSessions(prev => [data, ...prev]); }
                      });
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
                className="flex-1 flex flex-col min-h-0 p-4 max-w-4xl mx-auto w-full"
              >
                <ConversationPractice
                  topic={topic}
                  onFinish={resetToModeSelection}
                  noFrame={false}
                />
              </motion.div>
            )}
          </AnimatePresence>

        </main>
      </div>
    </div>
  );
}
