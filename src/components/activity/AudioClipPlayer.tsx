'use client';

import React from 'react';
import { RotateCcw, Volume2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAudioClip } from '@/hooks/useAudioClip';

export interface AudioClipPlayerProps {
  src: string | null;
  maxPlays?: number;
  label?: string;
}

/** @param props AudioClipPlayerProps */
export function AudioClipPlayer({ src, maxPlays, label }: AudioClipPlayerProps) {
  const t = useTranslations('errors');
  const clip = useAudioClip({ src, maxPlays });

  if (clip.state === 'error') {
    return (
      <div role="alert" className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-red-600">{t('audioUnavailable')}</p>
        {src && (
          <button
            type="button"
            onClick={clip.retry}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition cursor-pointer"
          >
            <RotateCcw size={14} />
            {t('retry')}
          </button>
        )}
      </div>
    );
  }

  const busy = clip.state === 'loading' || clip.state === 'playing';
  const disabled = !clip.canPlay || busy;
  const text = clip.playsUsed === 0 ? (label ?? t('audioPlay')) : clip.canPlay ? t('audioPlayAgain') : t('audioPlayed');

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={clip.play}
        disabled={disabled}
        aria-busy={clip.state === 'loading'}
        className={[
          'flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition',
          disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer',
        ].join(' ')}
      >
        <Volume2 size={16} />
        {clip.state === 'loading' ? t('audioLoading') : text}
      </button>
      {clip.remaining !== null && (
        <p className="text-xs text-gray-400">
          {clip.canPlay ? t('audioPlaysLeft', { count: clip.remaining }) : t('audioMaxReached')}
        </p>
      )}
    </div>
  );
}
