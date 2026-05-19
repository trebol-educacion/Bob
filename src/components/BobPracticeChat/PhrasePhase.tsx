'use client';

import React from 'react';
import { Mic, Square, Loader2, ArrowRight, RotateCcw } from 'lucide-react';
import { UsePracticeChatReturn } from '@/hooks/usePracticeChat';
import { ChatInputBar } from '@/components/chat/ChatInputBar';

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
  | 'handleRetry'
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
  handleRetry,
  dynamicPhrases,
  currentIndex,
  onBack,
}: PhrasePhaseProps) {
  if (phase === 'topic-input') {
    return (
      <ChatInputBar
        variant="text"
        value={inputText}
        placeholder="Write your situation here..."
        disabled={!inputText.trim()}
        onChange={setInputText}
        onSend={handleTopicSubmit}
      />
    );
  }

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
        <div className="flex justify-center">
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
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-2 px-5 py-2.5 border-2 border-trebol-border text-trebol-text rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
          >
            <RotateCcw size={15} /> Try again
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 bg-trebol-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
          >
            {currentIndex < dynamicPhrases.length - 1 ? 'Next phrase' : 'Finish session'}
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
            New session
          </button>
        </div>
      )}
    </div>
  );
}
