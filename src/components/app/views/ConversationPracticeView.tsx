'use client';

import React from 'react';
import { ConversationPractice } from '@/components/ConversationPractice';
import { resolveEffectiveLevel } from '@/lib/levels/effective-level';
import { mapStoredMessagesToConversation } from '@/lib/conversation/restore';
import type { StoredMessage } from '@/actions/messages';
import type { CefrLevel } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';

export interface ConversationPracticeViewProps {
  topic: string;
  selectedMessages: StoredMessage[];
  activeSessionId: string | null;
  skillLevels: SkillLevelMap | null;
  cefrActiveLevel: CefrLevel | null;
  onFinish: () => void;
  onConversationSessionStart: (topic: string) => Promise<string | undefined>;
  refreshSessions: () => void;
}

export function ConversationPracticeView({
  topic,
  selectedMessages,
  activeSessionId,
  skillLevels,
  cefrActiveLevel,
  onFinish,
  onConversationSessionStart,
  refreshSessions,
}: ConversationPracticeViewProps) {
  return (
    <ConversationPractice
      topic={selectedMessages.length > 0 ? topic : ''}
      onFinish={onFinish}
      noFrame={true}
      onSessionStart={onConversationSessionStart}
      onSessionFinished={refreshSessions}
      level={resolveEffectiveLevel(skillLevels, cefrActiveLevel, 'speaking').level ?? undefined}
      sessionId={activeSessionId ?? undefined}
      initialMessages={selectedMessages.length > 0 ? mapStoredMessagesToConversation(selectedMessages) : undefined}
    />
  );
}
