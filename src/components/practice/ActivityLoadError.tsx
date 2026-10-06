'use client';

import { useTranslations } from 'next-intl';

export interface ActivityLoadErrorProps {
  code?: string | null;
  message?: string | null;
  onBack: () => void;
  onRetry?: () => void;
}

export function ActivityLoadError({ code, message, onBack, onRetry }: ActivityLoadErrorProps) {
  const t = useTranslations('errors');
  const text = message ?? (code === 'no_content' ? t('activityNoContent') : t('activityLoadFailed'));
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
      <p className="text-red-500 font-semibold">{text}</p>
      <div className="flex gap-3">
        {onRetry && code !== 'no_content' ? (
          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors text-sm"
          >
            {t('retry')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
        >
          {t('activityBack')}
        </button>
      </div>
    </div>
  );
}
