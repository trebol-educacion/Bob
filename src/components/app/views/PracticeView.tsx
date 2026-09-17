'use client';

import React from 'react';
import { BobPracticeChat } from '@/components/BobPracticeChat';
import { createSessionAction, type BobSession } from '@/actions/sessions';
import { isFceImageMode } from '@/lib/routing';
import type { StoredMessage } from '@/actions/messages';
import type { CefrLevel } from '@/lib/types/practice';

export interface PracticeViewProps {
  mode: string;
  onFinish: () => void;
  cefrActiveLevel: CefrLevel | null;
  activeSessionId: string | null;
  selectedMessages: StoredMessage[];
  setActiveSessionId: (id: string | null) => void;
  setSessions: React.Dispatch<React.SetStateAction<BobSession[]>>;
  refreshSessions: () => void;
}

export function PracticeView({
  mode,
  onFinish,
  cefrActiveLevel,
  activeSessionId,
  selectedMessages,
  setActiveSessionId,
  setSessions,
  refreshSessions,
}: PracticeViewProps) {
  if (isFceImageMode(mode)) {
    return (
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
    );
  }

  return (
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
  );
}
