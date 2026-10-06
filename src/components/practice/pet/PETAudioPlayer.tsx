'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const ACCENT = '#10B981';
const ACCENT_TEXT = '#047857';

let activeAudio: HTMLAudioElement | null = null;

/**
 * @returns stops the clip currently playing in any PET audio player
 */
export function stopActivePETAudio(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 10 9 10" />
    </svg>
  );
}

export interface PETAudioPlayerProps {
  url: string;
  idleLabel: string;
}

export function PETAudioPlayer({ url, idleLabel }: PETAudioPlayerProps) {
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopLocal = () => {
    const current = audioRef.current;
    if (current) current.pause();
    if (activeAudio === current) activeAudio = null;
    audioRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  };

  useEffect(() => () => stopLocal(), []);

  const handlePlay = async () => {
    if (playing) {
      stopLocal();
      setProgress(0);
      return;
    }
    stopActivePETAudio();
    setFailed(false);
    const audio = new Audio(url);
    audioRef.current = audio;
    activeAudio = audio;
    audio.onended = () => {
      stopLocal();
      setHasPlayed(true);
      setProgress(1);
      setTimeout(() => setProgress(0), 600);
    };
    audio.onerror = () => {
      stopLocal();
      setFailed(true);
    };
    setPlaying(true);
    intervalRef.current = setInterval(() => {
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
    }, 100);
    try {
      await audio.play();
    } catch {
      stopLocal();
      setFailed(true);
    }
  };

  if (!url) {
    return (
      <div className="rounded-full ring-1 ring-gray-100 bg-gray-50 px-3 py-2 flex items-center gap-3 h-12">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-200 text-gray-400">
          <PlayIcon />
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
          onClick={handlePlay}
          aria-label={label}
          className="relative w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 text-white"
          style={{ background: ACCENT }}
        >
          {playing ? <PauseIcon /> : hasPlayed || failed ? <ReplayIcon /> : <PlayIcon />}
        </button>
      </div>
      <p className="flex-1 text-xs font-semibold truncate" style={{ color: failed ? '#B91C1C' : ACCENT_TEXT }}>{label}</p>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] bg-emerald-200/60">
        <div className="h-full transition-all" style={{ width: `${Math.round(progress * 100)}%`, background: ACCENT }} />
      </div>
    </div>
  );
}
