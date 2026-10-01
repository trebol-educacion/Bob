'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ACCENT, ACCENT_DARK, ACCENT_TINT } from './speaking-theme';

export function PlaybackPlayer({ url }: { url: string }) {
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  function toggle() {
    if (playing) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlaying(false);
      return;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { audioRef.current = null; setPlaying(false); };
    audio.onerror = () => { audioRef.current = null; setPlaying(false); };
    setPlaying(true);
    audio.play().catch(() => { audioRef.current = null; setPlaying(false); });
  }

  return (
    <div className="rounded-full ring-1 ring-gray-100 px-3 py-2 flex items-center gap-3 h-12" style={{ background: ACCENT_TINT }}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Listen back'}
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
        {playing ? 'Playing your answer…' : 'Listen back to your answer'}
      </p>
    </div>
  );
}
