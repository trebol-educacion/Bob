'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { classifyActivityError } from '@/lib/activity/error-kind';

export interface ActivityErrorStateProps {
  code?: string | null;
  retryable?: boolean | null;
  title?: string;
  message?: string | null;
  retryLabel?: string;
  backLabel?: string;
  onRetry?: () => void;
  onBack?: () => void;
  variant?: 'page' | 'banner';
}

/** @param props ActivityErrorStateProps */
export function ActivityErrorState({
  code,
  retryable,
  title,
  message,
  retryLabel,
  backLabel,
  onRetry,
  onBack,
  variant = 'page',
}: ActivityErrorStateProps) {
  const t = useTranslations('errors');
  const kind = classifyActivityError(code, retryable);
  const canRetry = kind !== 'no_content' && Boolean(onRetry);
  const text = message ?? (kind === 'no_content' ? t('activityNoContent') : t('activityLoadFailed'));
  const retryText = retryLabel ?? t('retry');

  if (variant === 'banner') {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-700">{text}</p>
        </div>
        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 text-xs font-black text-red-700 uppercase tracking-wider hover:underline cursor-pointer"
          >
            {retryText}
          </button>
        )}
      </div>
    );
  }

  const heading = title ?? (kind === 'no_content' ? t('activityComingSoon') : t('activityErrorTitle'));

  return (
    <div role="alert" className="flex flex-col items-center justify-center flex-1 p-8 gap-5 text-center min-h-[40vh]">
      <p className="text-lg font-bold text-gray-800">{heading}</p>
      <p className="text-sm text-gray-500 max-w-xs">{text}</p>
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition cursor-pointer"
        >
          <RotateCcw size={16} />
          {retryText}
        </button>
      )}
      {onBack && (
        <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer">
          {backLabel ?? t('activityBack')}
        </button>
      )}
    </div>
  );
}
