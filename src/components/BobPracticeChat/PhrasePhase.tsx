'use client';

import React from 'react';
import { Send, Mic, Square, Loader2, ArrowRight } from 'lucide-react';
import { UsePracticeChatReturn } from '@/hooks/usePracticeChat';

type PhrasePhaseProps = Pick<
  UsePracticeChatReturn,
  | 'phase'
  | 'inputText'
  | 'setInputText'
  | 'handleTopicSubmit'
  | 'handleAudioStart'
  | 'stopRecording'
  | 'isRecording'
  | 'handleNext'
  | 'dynamicPhrases'
  | 'currentIndex'
  | 'onBack'
  | 'topic'
>;

export function PhrasePhase({
  phase,
  inputText,
  setInputText,
  handleTopicSubmit,
  handleAudioStart,
  stopRecording,
  isRecording,
  handleNext,
  dynamicPhrases,
  currentIndex,
  onBack,
}: PhrasePhaseProps) {
  return (
    <div className="shrink-0 border-t border-trebol-border bg-white px-4 py-3">
      {phase === 'topic-input' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTopicSubmit();
          }}
          className="flex gap-2"
        >
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Escribe aquí tu situación..."
            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-trebol-border focus:border-trebol-primary focus:outline-none text-sm bg-slate-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="px-4 py-2.5 bg-trebol-primary text-white rounded-xl font-bold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Send size={18} />
          </button>
        </form>
      )}

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
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 bg-trebol-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
          >
            {currentIndex < dynamicPhrases.length - 1 ? 'Siguiente frase' : 'Finalizar sesión'}
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {phase === 'finished' && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-2.5 bg-trebol-secondary text-trebol-text rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Nueva sesión
          </button>
        </div>
      )}
    </div>
  );
}
