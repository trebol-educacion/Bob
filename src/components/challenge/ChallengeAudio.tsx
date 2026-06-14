'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2 } from 'lucide-react';

interface Props {
  script: string;
  playLimit: number;
  audioUrl?: string;
}

/**
 * Listening playback for the challenge. Uses the browser SpeechSynthesis API to
 * read the script aloud (no LLM/TTS network call). `audioUrl` is reserved for
 * future pre-generated audio; when present it should replace this behaviour.
 */
export function ChallengeAudio({ script, playLimit }: Props) {
  const [playsLeft, setPlaysLeft] = useState(playLimit);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  useEffect(() => () => stop(), [stop]);

  const play = useCallback(() => {
    if (!supported || playsLeft <= 0) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.lang = 'en-GB';
    utterance.rate = 0.92;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    utteranceRef.current = utterance;
    setSpeaking(true);
    setPlaysLeft((n) => n - 1);
    window.speechSynthesis.speak(utterance);
  }, [supported, playsLeft, script]);

  return (
    <div className="rounded-2xl border border-trebol-border bg-[#dde4f2]/40 p-4 flex items-center gap-3">
      <button
        onClick={speaking ? stop : play}
        disabled={!speaking && (playsLeft <= 0 || !supported)}
        className="shrink-0 w-12 h-12 rounded-full bg-[#3660AB] text-white flex items-center justify-center shadow-md disabled:opacity-40 hover:scale-105 active:scale-95 transition-transform"
        aria-label={speaking ? 'Pause audio' : 'Play audio'}
      >
        {speaking ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-black text-trebol-text">
          <Volume2 size={15} strokeWidth={2.5} className="text-[#3660AB]" />
          Audio
        </div>
        <p className="text-[11px] font-bold text-trebol-text/55 mt-0.5">
          {supported
            ? `${playsLeft} ${playsLeft === 1 ? 'play' : 'plays'} left`
            : 'Audio playback is not supported in this browser'}
        </p>
      </div>
    </div>
  );
}
