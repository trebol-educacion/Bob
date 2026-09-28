import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Mic, Square, Send, ArrowRight, Wand2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/Button';
import type { EvaluationResult } from '@/actions/gemini';

type ConversationPhase = 'topic-input' | 'conversation' | 'questions' | 'finished';

export interface ConversationControlsLabels {
  placeholderTopic: string;
  placeholderAnswer: string;
  skipToQuestions: string;
  simulateResponse: string;
  evaluateComprehension: string;
  speak: string;
  stop: string;
}

export interface ConversationControlsProps {
  phase: ConversationPhase;
  labels: ConversationControlsLabels;
  showEvaluation: boolean;
  currentEvaluation: EvaluationResult | null;
  onDismissEvaluation: () => void;
  isRecording: boolean;
  isProcessing: boolean;
  topicInput: string;
  onTopicInputChange: (value: string) => void;
  onTopicConfirm: () => void;
  inputText: string;
  onInputTextChange: (value: string) => void;
  onSendTextMessage: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onGoToQuestions: () => void;
  onSimulateResponse: () => void;
  messagesCount: number;
  maxTurns: number;
}

export function ConversationControls({
  phase,
  labels,
  showEvaluation,
  currentEvaluation,
  onDismissEvaluation,
  isRecording,
  isProcessing,
  topicInput,
  onTopicInputChange,
  onTopicConfirm,
  inputText,
  onInputTextChange,
  onSendTextMessage,
  onStartRecording,
  onStopRecording,
  onGoToQuestions,
  onSimulateResponse,
  messagesCount,
  maxTurns,
}: ConversationControlsProps) {
  return (
    <div className="flex-none border-t border-gray-100 bg-white px-4 py-3 space-y-3">
      <AnimatePresence>
        {showEvaluation && currentEvaluation && !isRecording && !isProcessing && phase === 'conversation' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 py-3 rounded-xl flex items-center justify-between gap-3"
            style={{
              background: 'color-mix(in oklab, var(--color-bob-brand) 8%, white)',
              border: '1px solid color-mix(in oklab, var(--color-bob-brand) 15%, white)',
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="text-white font-black text-sm px-2 py-1 rounded-lg"
                style={{ background: 'var(--color-bob-brand)' }}
              >
                {currentEvaluation.score}/100
              </span>
              <p className="text-sm font-medium text-gray-700 italic truncate max-w-xs">
                &quot;{currentEvaluation.feedback}&quot;
              </p>
            </div>
            <button
              onClick={onDismissEvaluation}
              className="text-xs font-black text-bob-brand uppercase tracking-wider hover:underline shrink-0"
            >
              Ok
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'topic-input' && (
        <form onSubmit={(e) => { e.preventDefault(); onTopicConfirm(); }} className="flex gap-2">
          <input
            value={topicInput}
            onChange={(e) => onTopicInputChange(e.target.value)}
            placeholder={labels.placeholderTopic}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-gray-400 focus:outline-none text-sm bg-slate-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={!topicInput.trim()}
            className="px-4 py-2.5 text-white rounded-xl font-bold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
            style={{ background: 'var(--color-bob-brand)' }}
          >
            <Send size={18} />
          </button>
        </form>
      )}

      {phase === 'conversation' && (
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => onInputTextChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSendTextMessage()}
                placeholder={labels.placeholderAnswer}
                disabled={isProcessing || isRecording}
                className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:border-gray-400 font-medium text-sm"
              />
              <button
                onClick={onSendTextMessage}
                disabled={!inputText.trim() || isProcessing || isRecording}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white p-2 rounded-full hover:scale-105 transition-transform disabled:opacity-30"
                style={{ background: 'var(--color-bob-brand)' }}
              >
                <Send size={18} />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {!isRecording ? (
                <button
                  onClick={onStartRecording}
                  disabled={isProcessing}
                  className="text-white p-4 rounded-full shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
                  style={{ background: 'var(--color-bob-brand)' }}
                >
                  <Mic size={24} />
                </button>
              ) : (
                <button
                  onClick={onStopRecording}
                  className="bg-red-500 text-white p-4 rounded-full shadow-lg animate-pulse"
                >
                  <Square size={24} fill="currentColor" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={onGoToQuestions}
              disabled={isProcessing}
              className="px-4 py-2 text-xs flex items-center space-x-2"
            >
              <ArrowRight size={14} />
              <span>{labels.skipToQuestions}</span>
            </Button>

            <button
              onClick={onSimulateResponse}
              disabled={isProcessing || isRecording}
              className="flex items-center space-x-2 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-gray-600 disabled:opacity-30"
            >
              <Wand2 size={16} />
              <span>{labels.simulateResponse}</span>
            </button>

            {messagesCount >= maxTurns && !isProcessing && (
              <button
                onClick={onGoToQuestions}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold uppercase text-[10px] flex items-center space-x-2 hover:bg-green-700"
              >
                <span>{labels.evaluateComprehension}</span>
                <CheckCircle size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'questions' && (
        <div className="flex items-center justify-center">
          {!isRecording ? (
            <Button
              variant="primary"
              disabled={isProcessing}
              onClick={onStartRecording}
              className="w-full max-w-[200px] flex items-center justify-center space-x-2 py-4 rounded-full shadow-lg"
            >
              <Mic size={24} />
              <span className="font-bold">{labels.speak}</span>
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={onStopRecording}
              className="w-full max-w-[200px] flex items-center justify-center space-x-2 py-4 rounded-full shadow-lg animate-pulse"
            >
              <Square size={24} fill="currentColor" />
              <span className="font-bold">{labels.stop}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
