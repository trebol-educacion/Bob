'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { PracticeSurface } from '@/components/practice/free/PracticeSurface';
import { PracticeBootBubble } from '@/components/practice/free/PracticeBootBubble';
import { ConversationErrorBanner } from '@/components/conversation/ConversationErrorBanner';
import { usePracticeBoot } from '@/hooks/practice/usePracticeBoot';
import type { Organization } from '@/lib/organization';
import type { CefrLevel } from '@/lib/types/practice';
import type { PracticeActivityMode } from '@/lib/practice/types';
import type { SkillLevelMap } from '@/lib/types/skills';

export interface PracticeSessionViewProps {
  mode: PracticeActivityMode;
  organization: Organization | null;
  cefrActiveLevel: CefrLevel | null;
  skillLevels: SkillLevelMap | null;
  onExit: () => void;
}

/** @param props PracticeSessionViewProps */
export function PracticeSessionView({ mode, organization, cefrActiveLevel, skillLevels, onExit }: PracticeSessionViewProps) {
  const t = useTranslations('practice');
  const boot = usePracticeBoot({ mode, organization, cefrActiveLevel, skillLevels });

  const failed = boot.phase === 'ready' && !boot.message && boot.messages.length === 0;

  if (failed) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
        <ConversationErrorBanner
          message={t('errors.startError')}
          retryLabel={t('errors.retry')}
          onRetry={boot.restart}
        />
      </div>
    );
  }

  if (boot.phase === 'ready') {
    return (
      <PracticeSurface
        key={boot.sessionId ?? 'in-memory'}
        sessionId={boot.sessionId}
        mode={boot.mode}
        seed={boot.seed}
        level={boot.level}
        framing={boot.framing}
        messages={boot.messages}
        turnSignals={boot.turnSignals}
        onExit={onExit}
        onRestart={boot.restart}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <PracticeBootBubble
          framing={boot.framing}
          message={boot.message}
          scenarioTitle={t('scenarioTitle')}
          preparingLabel={t('starting')}
        />
      </div>
    </div>
  );
}
