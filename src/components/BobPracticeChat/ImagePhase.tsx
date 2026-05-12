'use client';

import React from 'react';
import { Mic, Square, Loader2, ArrowRight } from 'lucide-react';
import { UsePracticeChatReturn } from '@/hooks/usePracticeChat';

type ImagePhaseProps = Pick<
  UsePracticeChatReturn,
  | 'phase'
  | 'handleAudioStart'
  | 'stopRecording'
  | 'handleNextImage'
>;

export function ImagePhase({
  phase,
  handleAudioStart,
  stopRecording,
  handleNextImage,
}: ImagePhaseProps) {
  return (
    <div className="shrink-0 border-t border-trebol-border bg-white px-4 py-3">
      {phase === 'phrase-ready' && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleAudioStart}
            className="flex items-center gap-3 px-8 py-3 bg-trebol-primary text-white rounded-full font-bold text-sm hover:opacity-90 transition-opacity shadow-lg"
          >
            <Mic size={20} /> Grabar respuesta
          </button>
        </div>
      )}

      {phase === 'recording' && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-3 px-8 py-3 bg-red-500 text-white rounded-full font-bold text-sm hover:opacity-90 transition-opacity shadow-lg animate-pulse"
          >
            <Square size={18} /> Detener grabación
          </button>
        </div>
      )}

      {(phase === 'generating' || phase === 'evaluating') && (
        <div className="flex justify-center py-1">
          <span className="text-sm text-trebol-text/50 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Procesando...
          </span>
        </div>
      )}

      {phase === 'result' && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => handleNextImage()}
            className="flex items-center gap-2 px-6 py-2.5 bg-trebol-primary text-white rounded-full font-bold text-sm hover:opacity-90 transition-opacity shadow-lg"
          >
            <ArrowRight size={18} /> Nueva imagen
          </button>
        </div>
      )}

      {phase === 'image-config' && (
        <p className="text-xs text-trebol-text/50 text-center py-1">
          Configura la escena arriba para comenzar
        </p>
      )}
    </div>
  );
}
