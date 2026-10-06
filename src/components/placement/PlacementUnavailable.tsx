'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const canRetry = failure?.retryable ?? true;

  return (
    <div role="alert" className="flex flex-col items-center justify-center flex-1 p-8 gap-5 text-center">
      <p className="text-lg font-bold text-gray-800">{t('unavailableTitle')}</p>
      <p className="text-sm text-gray-500 max-w-xs">{noContent ? t('unavailableNoContent') : t('unavailableError')}</p>
      {canRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 bg-trebol-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 transition"
        >
          <RotateCcw size={16} /> {t('unavailableRetry')}
        </button>
      )}
      <button onClick={onLeave} className="text-sm text-gray-500 hover:text-gray-700 transition">
        {leaveLabel === 'continue' ? t('unavailableContinue') : t('unavailableBack')}
      </button>
    </div>
  );
}
