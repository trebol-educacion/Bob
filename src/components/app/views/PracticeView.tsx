'use client';

import React from 'react';
import { BobPracticeChat } from '@/components/BobPracticeChat';
import { openGenericSessionAction } from '@/actions/generic-session';
import { resolveEffectiveLevel } from '@/lib/levels/effective-level';
import type { StoredMessage } from '@/actions/messages';
import type { CefrLevel } from '@/lib/types/practice';
import type { Skill, SkillLevelMap } from '@/lib/types/skills';

export interface PracticeViewProps {
  mode: string;
  onFinish: () => void;
  cefrActiveLevel: CefrLevel | null;
  skillLevels: SkillLevelMap | null;
  selectedSkill: Skill | null;
  activeSessionId: string | null;
  selectedMessages: StoredMessage[];
  setActiveSessionId: (id: string | null) => void;
  refreshSessions: () => void;
}

export function PracticeView({
  mode,
  onFinish,
  cefrActiveLevel,
  skillLevels,
  selectedSkill,
  activeSessionId,
  selectedMessages,
  setActiveSessionId,
  refreshSessions,
}: PracticeViewProps) {
  const { level: effectiveLevel } = resolveEffectiveLevel(skillLevels, cefrActiveLevel, selectedSkill);
  return (
    <BobPracticeChat
      mode={mode === 'generic_image' ? 'image' : 'situation'}
      level={(effectiveLevel as 'a1' | 'a2' | 'b1' | 'b2' | undefined) ?? undefined}
      onBack={onFinish}
      onSessionStart={async (title) => {
        const opened = await openGenericSessionAction({ mode, topic: title, title });
        if (!opened.ok) return undefined;
        setActiveSessionId(opened.data.sessionId);
        refreshSessions();
        return opened.data.sessionId;
      }}
      onSessionFinished={refreshSessions}
      sessionId={activeSessionId}
      initialMessages={selectedMessages.length > 0 ? selectedMessages : undefined}
    />
  );
}
