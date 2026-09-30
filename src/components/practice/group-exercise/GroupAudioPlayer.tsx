'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Volume2 } from 'lucide-react';
import { resolveListeningAudioUrl } from './listening-audio-url';

export interface GroupAudioPlayerProps {
  audioPath: string | null;
  maxPlays?: number;
  label?: string;
}

export function GroupAudioPlayer({ audioPath, maxPlays = 2, label = 'Play audio' }: GroupAudioPlayerProps) {
  const [playsUsed, setPlaysUsed] = useState(0);
  const [failed, setFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const play = useCallback(() => {
    if (!audioPath) return;
    audioRef.current?.pause();
    const audio = new Audio(resolveListeningAudioUrl(audioPath));
    audio.onerror = () => setFailed(true);
    audioRef.current = audio;
    setFailed(false);
    audio.play().catch(() => setFailed(true));
    setPlaysUsed((used) => used + 1);
  }, [audioPath]);

  const retry = useCallback(() => {
    setPlaysUsed((used) => Math.max(0, used - 1));
    setFailed(false);
  }, []);

  if (!audioPath || failed) {
    return (
      <div role="alert" className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-red-600">The audio is not available right now.</p>
        {audioPath && (
          <button
            type="button"
            onClick={retry}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition cursor-pointer"
          >
            <RotateCcw size={14} />
            Try again
          </button>
        )}
      </div>
    );
  }

  const canPlay = playsUsed < maxPlays;
  const remaining = maxPlays - playsUsed;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={play}
        disabled={!canPlay}
        className={[
          'flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition',
          canPlay ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed',
        ].join(' ')}
      >
        <Volume2 size={16} />
        {playsUsed === 0 ? label : canPlay ? 'Play again' : 'Audio played'}
      </button>
      <p className="text-xs text-gray-400">
        {canPlay ? `${remaining} play${remaining === 1 ? '' : 's'} remaining` : 'Maximum plays reached'}
      </p>
    </div>
  );
}
