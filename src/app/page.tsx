'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ModeSelection } from '@/components/ModeSelection';
import { ConversationPractice } from '@/components/ConversationPractice';
import { SessionSidebar } from '@/components/SessionSidebar';
import { BobPracticeChat } from '@/components/BobPracticeChat';
import { CefrCtaBanner } from '@/components/CefrCtaBanner';
import { BobAccessDenied } from '@/components/BobAccessDenied';
import { createSessionAction } from '@/actions/sessions';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { Navbar } from '@/components/Navbar';
import { useSessionState } from '@/hooks/useSessionState';
import { useOrganization } from '@/hooks/useOrganization';
import { B1CollaborativePractice } from '@/components/B1CollaborativePractice';
import { A2Part1Practice } from '@/components/A2Part1Practice';
import { ToeflListenRepeatPractice } from '@/components/ToeflListenRepeatPractice';
import { ToeflInterviewPractice } from '@/components/ToeflInterviewPractice';
import {
  YLPart1Practice,
  YLPart2Practice,
  YLPart3Practice,
  YLPart4Practice,
  YLPointingPractice,
} from '@/components/practice/yl';
import type { PracticeMode, ModeKey } from '@/lib/types/practice';
import type { StoredMessage } from '@/actions/messages';

type AppState =
  | 'mode-selection'
  | 'practicing'
  | 'conversation-practicing'
  | 'exam-practicing';

// ---------------------------------------------------------------------------
// YL mode routing
// ---------------------------------------------------------------------------

/** All 9 Cambridge A1 Young Learners mode keys. */
const YL_MODES = new Set<ModeKey>([
  'cambridge_starters_part1',
  'cambridge_starters_part2',
  'cambridge_starters_part3',
  'cambridge_starters_part4',
  'cambridge_movers_part1',
  'cambridge_movers_part2',
  'cambridge_movers_part3',
  'cambridge_movers_part4',
  'cambridge_movers_part5',
]);

interface YLRenderProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
}

/**
 * Maps each YL mode key to a factory that renders the correct component
 * with the right `exam` and `part` props pre-bound.
 * O(1) lookup — avoids long switch chains.
 */
const MODE_COMPONENT_MAP: Partial<Record<ModeKey, (props: YLRenderProps) => React.JSX.Element>> = {
  cambridge_starters_part1: (p) => <YLPointingPractice exam="starters" part={1} {...p} />,
  cambridge_starters_part2: (p) => <YLPart2Practice exam="starters" part={2} {...p} />,
  cambridge_starters_part3: (p) => <YLPart3Practice exam="starters" part={3} {...p} />,
  cambridge_starters_part4: (p) => <YLPart4Practice exam="starters" part={4} {...p} />,
  cambridge_movers_part1:   (p) => <YLPart1Practice exam="movers"   part={1} {...p} />,
  cambridge_movers_part2:   (p) => <YLPart2Practice exam="movers"   part={2} {...p} />,
  cambridge_movers_part3:   (p) => <YLPart3Practice exam="movers"   part={3} {...p} />,
  cambridge_movers_part4:   (p) => <YLPart4Practice exam="movers"   part={4} {...p} />,
  cambridge_movers_part5:   (p) => <YLPart4Practice exam="movers"   part={5} {...p} />,
};

export default function App() {
  const [appState, setAppState] = useState<AppState>('mode-selection');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const { organization, enabledModes, availableModes, cefrActiveLevel, cefrLevelLocked, setCefrActiveLevel, loading: orgLoading, accessDenialReason } = useOrganization();

  // Ref forwarded to ModeSelection so the banner can scroll to the selector
  const cefrSelectorRef = useRef<HTMLDivElement>(null);

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
      if (sessionMode === 'generic_conversation') {
        setTopic(sessionTopic);
        setAppState('conversation-practicing');
      } else if (
        YL_MODES.has(sessionMode as ModeKey) ||
        sessionMode === 'cambridge_pet_p3' ||
        sessionMode === 'cambridge_ket_part1' ||
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
    if (m === 'generic_conversation') {
      setAppState('conversation-practicing');
    } else if (
      (m !== null && YL_MODES.has(m)) ||
      m === 'cambridge_pet_p3' ||
      m === 'cambridge_ket_part1' ||
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

  const handleBannerScroll = useCallback(() => {
    cefrSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const showBanner = cefrActiveLevel === null && !cefrLevelLocked;

  if (!orgLoading && accessDenialReason) {
    return <BobAccessDenied reason={accessDenialReason} />;
  }

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
                className="w-full flex-1 overflow-y-auto"
              >
                {organization && organization.is_bob_enabled === false ? (
                  <div className="w-full flex-1 flex flex-col items-center justify-center py-24 px-4 text-center">
                    <div className="bg-white shadow-md rounded-2xl p-10 max-w-md w-full space-y-3">
                      <p className="text-2xl font-black text-trebol-text">Bob no está disponible en tu colegio</p>
                      <p className="text-trebol-text opacity-60 font-medium text-sm">
                        Contacta con el administrador de tu colegio si crees que es un error.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {showBanner && <CefrCtaBanner onScroll={handleBannerScroll} />}
                    <div className="w-full max-w-4xl mx-auto flex flex-col items-center py-8 px-4 pb-12">
                      {organization && (
                        <p className="text-sm text-trebol-text/50 mb-4 text-center">{organization.name}</p>
                      )}
                      <ModeSelection
                        ref={cefrSelectorRef}
                        onSelect={handleModeSelect}
                        enabledModes={enabledModes}
                        availableModes={availableModes}
                        cefrActiveLevel={cefrActiveLevel}
                        cefrLevelLocked={cefrLevelLocked}
                        onCefrChange={setCefrActiveLevel}
                      />
                    </div>
                  </>
                )}
              </motion.div>
            )}


            {appState === 'practicing' && mode && mode !== 'generic_conversation' && (
              <motion.div
                key={`practicing-${mode}-${selectedMessages.length > 0 ? activeSessionId : 'new'}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col min-h-0"
              >
                {mode === 'cambridge_fce_p1' ? (
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
                key={`exam-practicing-${mode}-${activeSessionId ?? 'new'}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col min-h-0"
              >
                {/* Cambridge YL (A1) — dispatched via MODE_COMPONENT_MAP */}
                {YL_MODES.has(mode) && MODE_COMPONENT_MAP[mode]?.({
                  onBack: onFinish,
                  sessionId: activeSessionId ?? undefined,
                  initialMessages: selectedMessages.length > 0 ? selectedMessages : undefined,
                  onSessionCreated: handleYLSessionCreated,
                })}

                {mode === 'cambridge_pet_p3' && (
                  <B1CollaborativePractice onBack={() => setAppState('mode-selection')} />
                )}
                {mode === 'cambridge_ket_part1' && (
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
