import { useState, useEffect, useCallback } from 'react';
import { createSessionAction, getSessionsAction, deleteSessionAction, BobSession } from '@/actions/sessions';
import { getMessagesAction, StoredMessage } from '@/actions/messages';

interface UseSessionStateReturn {
  sessions: BobSession[];
  activeSessionId: string | null;
  sessionsLoading: boolean;
  selectedSession: BobSession | null;
  selectedMessages: StoredMessage[];
  setSessions: React.Dispatch<React.SetStateAction<BobSession[]>>;
  setActiveSessionId: (id: string | null) => void;
  setSelectedMessages: (messages: StoredMessage[]) => void;
  setSelectedSession: (session: BobSession | null) => void;
  handleNewSession: (resetToModeSelection: () => void) => void;
  handleSelectSession: (id: string, onSelected: (mode: string, topic: string) => void) => Promise<void>;
  handleDeleteSession: (id: string, activeSessionId: string | null, resetToModeSelection: () => void) => Promise<void>;
  handleConversationSessionStart: (topic: string) => void;
}

export function useSessionState(userEmail: string | undefined): UseSessionStateReturn {
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

  const handleNewSession = useCallback((resetToModeSelection: () => void) => {
    setActiveSessionId(null);
    setSelectedMessages([]);
    setSelectedSession(null);
    resetToModeSelection();
  }, []);

  const handleSelectSession = useCallback(async (
    id: string,
    onSelected: (mode: string, topic: string) => void
  ) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    setActiveSessionId(id);
    setSelectedSession(session);
    const { data } = await getMessagesAction(id);
    setSelectedMessages(data ?? []);
    onSelected(session.mode ?? '', session.topic ?? '');
  }, [sessions]);

  const handleDeleteSession = useCallback(async (
    id: string,
    currentActiveId: string | null,
    resetToModeSelection: () => void
  ) => {
    const snapshot = sessions;
    setSessions(s => s.filter(x => x.id !== id));
    if (currentActiveId === id) { setActiveSessionId(null); resetToModeSelection(); }
    const { error } = await deleteSessionAction(id);
    if (error) { console.error('deleteSessionAction:', error); setSessions(snapshot); }
  }, [sessions]);

  const handleConversationSessionStart = useCallback((topic: string) => {
    createSessionAction({ mode: 'generic_conversation', topic, title: topic.slice(0, 60) || 'Conversación' })
      .then(({ data }) => {
        if (data) { setActiveSessionId(data.id); setSessions(prev => [data, ...prev]); }
      });
  }, []);

  return {
    sessions,
    activeSessionId,
    sessionsLoading,
    selectedSession,
    selectedMessages,
    setSessions,
    setActiveSessionId,
    setSelectedMessages,
    setSelectedSession,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
    handleConversationSessionStart,
  };
}
