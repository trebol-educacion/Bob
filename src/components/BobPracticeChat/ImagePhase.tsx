'use client';

import React, { useEffect } from 'react';
import { Mic, Square, Loader2, ArrowRight } from 'lucide-react';
import { UsePracticeChatReturn } from '@/hooks/usePracticeChat';
import { useCountdown } from '@/hooks/useCountdown';

type ImagePhaseProps = Pick<
  UsePracticeChatReturn,
  | 'phase'
  | 'handleAudioStart'
  | 'stopRecording'
  | 'handleNextImage'
> & {
  isRecording: boolean;
  onStopRecording: () => void;
  handleRetry?: () => void;
};

export function ImagePhase({
  phase,
  handleAudioStart,
  stopRecording,
  handleNextImage,
  isRecording,
  onStopRecording,
  handleRetry,
}: ImagePhaseProps) {
  const countdown = useCountdown({ seconds: 60, onComplete: onStopRecording });

  useEffect(() => {
    if (phase === 'recording') {
      countdown.start();
    } else {
      countdown.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div className="shrink-0 border-t border-trebol-border bg-white px-4 py-3">
      {phase === 'phrase-ready' && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleAudioStart}
            className="flex items-center gap-3 px-8 py-3 bg-trebol-primary text-white rounded-full font-bold text-sm hover:opacity-90 transition-opacity shadow-lg"
          >
            <Mic size={20} /> Record answer
          </button>
        </div>
      )}

      {phase === 'recording' && (
        <div className="flex flex-col items-center gap-3">
          <div
            className={`text-2xl font-mono font-bold tabular-nums ${
              countdown.remaining <= 10 ? 'text-red-500 animate-pulse' : 'text-trebol-text/60'
            }`}
          >
            {String(countdown.remaining).padStart(2, '0')}s
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-3 px-8 py-3 bg-red-500 text-white rounded-full font-bold text-sm hover:opacity-90 transition-opacity shadow-lg animate-pulse"
          >
            <Square size={18} /> Stop recording
          </button>
        </div>
      )}

      {(phase === 'generating' || phase === 'evaluating') && (
        <div className="flex justify-center py-1">
          <span className="text-sm text-trebol-text/50 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Processing...
          </span>
        </div>
      )}

      {phase === 'result' && (
        <div className="flex justify-center gap-3">
          {handleRetry && (
            <button
              type="button"
              onClick={handleRetry}
              className="flex items-center gap-2 px-5 py-2.5 border-2 border-trebol-border text-trebol-text rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={() => handleNextImage()}
            className="flex items-center gap-2 px-6 py-2.5 bg-trebol-primary text-white rounded-full font-bold text-sm hover:opacity-90 transition-opacity shadow-lg"
          >
            <ArrowRight size={18} /> New image
          </button>
        </div>
      )}

      {phase === 'image-config' && (
        <p className="text-xs text-trebol-text/50 text-center py-1">
          Configure the scene above to start
        </p>
      )}
    </div>
  );
}
