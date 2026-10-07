'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useAudioClip } from '@/hooks/useAudioClip';
import { ACCENT, ACCENT_DARK, ACCENT_TINT } from './speaking-theme';

export function PlaybackPlayer({ url }: { url: string }) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations('errors');
  const clip = useAudioClip({ src: url });
  const failed = clip.state === 'error';
  const playing = clip.state === 'playing' || clip.state === 'loading';

  function toggle() {
    if (playing) clip.stop();
    else if (failed) clip.retry();
    else clip.play();
  }

  return (
    <div className="rounded-full ring-1 ring-gray-100 px-3 py-2 flex items-center gap-3 h-12" style={{ background: ACCENT_TINT }}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause' : failed ? t('retry') : 'Listen back'}
        className="relative shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform active:scale-95"
        style={{ background: ACCENT }}
      >
        {playing && !reduceMotion && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ background: ACCENT }}
            initial={{ scale: 1, opacity: 0.4 }}
            animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
            transition={{ duration: 1.2, ease: 'easeOut', repeat: Infinity }}
          />
        )}
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="relative w-4 h-4">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="relative w-4 h-4">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <p className="flex-1 text-xs font-bold truncate" style={{ color: ACCENT_DARK }}>
        {failed ? t('audioUnavailable') : playing ? 'Playing your answer…' : 'Listen back to your answer'}
      </p>
    </div>
  );
}
