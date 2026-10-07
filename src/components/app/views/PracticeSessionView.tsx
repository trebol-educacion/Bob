'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { PracticeSurface } from '@/components/practice/free/PracticeSurface';
import { PracticeBootBubble } from '@/components/practice/free/PracticeBootBubble';
import { ConversationErrorBanner } from '@/components/conversation/ConversationErrorBanner';
import { usePracticeBoot, type PracticeResumeInput } from '@/hooks/practice/usePracticeBoot';
import type { Organization } from '@/lib/organization';
import type { CefrLevel } from '@/lib/types/practice';
import type { PracticeActivityMode } from '@/lib/practice/types';
import type { SkillLevelMap } from '@/lib/types/skills';

export interface PracticeSessionViewProps {
  mode: PracticeActivityMode;
  organization: Organization | null;
  cefrActiveLevel: CefrLevel | null;
  skillLevels: SkillLevelMap | null;
  resume?: PracticeResumeInput;
  onSessionCreated: (sessionId: string) => void;
  onSessionFinished: () => void;
  onPracticeAgain: () => void;
  onExit: () => void;
}

/** @param props PracticeSessionViewProps */
export function PracticeSessionView({
  mode,
  organization,
  cefrActiveLevel,
  skillLevels,
  resume,
  onSessionCreated,
  onSessionFinished,
  onPracticeAgain,
  onExit,
}: PracticeSessionViewProps) {
  const t = useTranslations('practice');
  const boot = usePracticeBoot({ mode, cefrActiveLevel, skillLevels, resume });

  if (boot.phase === 'error') {
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
        key={`${boot.sessionId ?? 'new'}:${boot.instance}`}
        sessionId={boot.sessionId}
        organizationId={organization?.id ?? null}
        mode={boot.mode}
        seed={boot.seed}
        level={boot.level}
        framing={boot.framing}
        messages={boot.messages}
        turnSignals={boot.turnSignals}
        imageUrl={boot.imageUrl}
        initialResult={boot.result}
        onSessionCreated={onSessionCreated}
        onSessionFinished={onSessionFinished}
        onExit={onExit}
        onRestart={resume ? onPracticeAgain : boot.restart}
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
