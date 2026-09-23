'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { PracticeSurface } from '@/components/practice/free/PracticeSurface';
import { ConversationErrorBanner } from '@/components/conversation/ConversationErrorBanner';
import { startPracticeAction, type StartPracticeResult } from '@/actions/practice/start';
import type { Organization } from '@/lib/organization';
import type { CefrLevel } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';

export interface PracticeSessionViewProps {
  organization: Organization | null;
  cefrActiveLevel: CefrLevel | null;
  skillLevels: SkillLevelMap | null;
  onExit: () => void;
}

/** @param props PracticeSessionViewProps */
export function PracticeSessionView({ organization, cefrActiveLevel, skillLevels, onExit }: PracticeSessionViewProps) {
  const t = useTranslations('practice');
  const [session, setSession] = useState<StartPracticeResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const start = useCallback(async () => {
    setFailed(false);
    setSession(null);
    try {
      const result = await startPracticeAction({
        mode: 'conversation',
        skillLevels,
        cefrActiveLevel,
        organizationId: organization?.id ?? null,
      });
      setSession(result);
    } catch (error) {
      console.error('[PracticeSessionView] startPracticeAction failed:', error);
      setFailed(true);
    }
  }, [skillLevels, cefrActiveLevel, organization]);

  useEffect(() => {
    void start();
  }, [start, attempt]);

  if (failed) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
        <ConversationErrorBanner
          message={t('errors.startError')}
          retryLabel={t('errors.retry')}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 size={32} className="animate-spin" />
        <p className="text-sm font-bold uppercase tracking-widest">{t('starting')}</p>
      </div>
    );
  }

  return (
    <PracticeSurface
      key={session.sessionId ?? 'in-memory'}
      sessionId={session.sessionId}
      mode={session.mode}
      seed={session.seed}
      level={session.level}
      framing={session.framing}
      message={session.message}
      onExit={onExit}
      onRestart={() => setAttempt((n) => n + 1)}
    />
  );
}
