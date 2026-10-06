'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ActivityErrorState } from '@/components/activity/ActivityErrorState';
import type { PlacementStartFailure } from '@/hooks/usePlacementRunner';

export interface PlacementUnavailableProps {
  failure: PlacementStartFailure | null;
  onRetry: () => void;
  onLeave: () => void;
  leaveLabel: 'continue' | 'back';
}

/** @param props PlacementUnavailableProps */
export function PlacementUnavailable({ failure, onRetry, onLeave, leaveLabel }: PlacementUnavailableProps) {
  const t = useTranslations('placement');
  const noContent = failure?.code === 'no_content';

  return (
    <ActivityErrorState
      code={failure?.code}
      retryable={failure?.retryable ?? true}
      title={t('unavailableTitle')}
      message={noContent ? t('unavailableNoContent') : t('unavailableError')}
      retryLabel={t('unavailableRetry')}
      backLabel={leaveLabel === 'continue' ? t('unavailableContinue') : t('unavailableBack')}
      onRetry={onRetry}
      onBack={onLeave}
    />
  );
}
