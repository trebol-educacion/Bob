'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useAudioClip } from '@/hooks/useAudioClip';
import { PauseIcon, PlayIcon, ReplayIcon } from '@/components/activity/audio-icons';

const ACCENT = '#10B981';
const ACCENT_TEXT = '#047857';

export interface PETAudioPlayerProps {
  url: string;
  idleLabel: string;
}

export function PETAudioPlayer({ url, idleLabel }: PETAudioPlayerProps) {
  const reduceMotion = useReducedMotion();
  const clip = useAudioClip({ src: url || null });
  const playing = clip.isPlaying;
  const hasPlayed = clip.hasPlayed;
  const failed = url ? clip.failed : false;
  const progress = clip.progress;

  if (!url) {
    return (
      <div className="rounded-full ring-1 ring-gray-100 bg-gray-50 px-3 py-2 flex items-center gap-3 h-12">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-200 text-gray-400">
          <PlayIcon className="w-5 h-5" />
        </div>
        <p className="flex-1 text-sm font-semibold text-gray-400">Audio unavailable</p>
      </div>
    );
  }

  const label = failed ? 'Audio failed. Try again' : playing ? 'Playing…' : hasPlayed ? 'Listen again' : idleLabel;

  return (
    <div className="relative rounded-full ring-1 ring-emerald-100 bg-emerald-50 px-3 py-2 flex items-center gap-3 h-12 overflow-hidden">
      <div className="relative shrink-0 w-10 h-10">
        {playing && (
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ background: ACCENT }}
            initial={{ scale: 1, opacity: 0.4 }}
            animate={reduceMotion ? { scale: 1, opacity: 0.25 } : { scale: [1, 1.6], opacity: [0.4, 0] }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1.2, ease: 'easeOut', repeat: Infinity }}
          />
        )}
        <button
          type="button"
          onClick={clip.toggle}
          aria-label={label}
          className="relative w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 text-white"
          style={{ background: ACCENT }}
        >
          {playing ? <PauseIcon className="w-5 h-5" /> : hasPlayed || failed ? <ReplayIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
        </button>
      </div>
      <p className="flex-1 text-xs font-semibold truncate" style={{ color: failed ? '#B91C1C' : ACCENT_TEXT }}>{label}</p>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] bg-emerald-200/60">
        <div className="h-full transition-all" style={{ width: `${Math.round(progress * 100)}%`, background: ACCENT }} />
      </div>
    </div>
  );
}
