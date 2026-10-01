'use client';

import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Mic, Square, Volume2, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PlaybackPlayer } from './PlaybackPlayer';
import { ProgressDots } from './ProgressDots';
import { Waveform } from './Waveform';
import { ACCENT, ACCENT_DARK, ACCENT_TINT, CARD_SURFACE, RECORDING_MAX_SECONDS } from './speaking-theme';
import type { QuestionRoundStep } from './types';

interface StageProps {
  header: React.ReactNode;
  planIntro: React.ReactNode;
  question: string;
  questionIndex: number;
  totalQuestions: number;
  step: QuestionRoundStep;
  isRecordingNow: boolean;
  recordingSeconds: number;
  currentReaction: string;
  playbackUrl: string | null;
  hearingQuestion: boolean;
  onHearQuestion: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onRetry: () => void;
  onSend: () => void;
}

export function QuestionRoundStage(props: StageProps) {
  const t = useTranslations('cambridge');
  const reduceMotion = useReducedMotion();
  const { step, isRecordingNow, questionIndex, totalQuestions, currentReaction } = props;

  return (
    <div className="flex flex-col h-full">
      {props.header}

      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="mx-auto w-full max-w-lg flex flex-col items-center gap-2">
          <ProgressDots total={totalQuestions} currentIndex={questionIndex} />
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            {questionIndex + 1}/{totalQuestions}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="mx-auto w-full max-w-lg flex flex-col gap-4">
          {props.planIntro}
          <AnimatePresence mode="wait">
            <motion.div
              key={`question-${questionIndex}`}
              initial={reduceMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="rounded-3xl border border-gray-100 shadow-sm px-5 py-6" style={{ background: CARD_SURFACE }}
            >
              <p className="text-xl font-bold text-gray-900 leading-snug">{props.question || '…'}</p>
              <button
                type="button"
                onClick={props.onHearQuestion}
                className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold transition-transform active:scale-95"
                style={{ background: ACCENT_TINT, color: ACCENT_DARK }}
              >
                <Volume2 size={14} />
                {props.hearingQuestion ? 'Stop' : 'Hear the question'}
              </button>
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-col items-center gap-3 pt-1">
            <AnimatePresence mode="wait">
              {step === 'review' && props.playbackUrl ? (
                <motion.div
                  key="review"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  className="w-full flex flex-col gap-3"
                >
                  <PlaybackPlayer url={props.playbackUrl} />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={props.onRetry}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-gray-600 border border-gray-200 bg-white transition-colors hover:bg-gray-50"
                    >
                      <RotateCcw size={16} />
                      {t('common.tryAgain')}
                    </button>
                    <button
                      type="button"
                      onClick={props.onSend}
                      className="flex-1 px-4 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 active:translate-y-1"
                      style={{ background: ACCENT, boxShadow: `0 4px 0 ${ACCENT_DARK}` }}
                    >
                      Send it!
                    </button>
                  </div>
                </motion.div>
              ) : step === 'processing' || step === 'transition' ? (
                <motion.div
                  key="processing"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  className="flex flex-col items-center gap-3 py-4"
                >
                  {step === 'transition' && currentReaction ? (
                    <p className="text-sm font-bold text-center px-2" style={{ color: ACCENT_DARK }}>
                      {currentReaction}
                    </p>
                  ) : (
                    <>
                      <div
                        className="w-8 h-8 border-2 rounded-full animate-spin"
                        style={{ borderColor: ACCENT, borderTopColor: 'transparent' }}
                      />
                      <p className="text-sm font-semibold text-gray-400">Listening to your answer…</p>
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="record"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    {isRecordingNow && !reduceMotion && (
                      <>
                        <motion.span
                          aria-hidden
                          className="absolute inset-0 rounded-full bg-red-400"
                          initial={{ scale: 1, opacity: 0.4 }}
                          animate={{ scale: [1, 1.7], opacity: [0.4, 0] }}
                          transition={{ duration: 1.4, ease: 'easeOut', repeat: Infinity }}
                        />
                        <motion.span
                          aria-hidden
                          className="absolute inset-0 rounded-full bg-red-400"
                          initial={{ scale: 1, opacity: 0.3 }}
                          animate={{ scale: [1, 1.7], opacity: [0.3, 0] }}
                          transition={{ duration: 1.4, ease: 'easeOut', repeat: Infinity, delay: 0.7 }}
                        />
                      </>
                    )}
                    <button
                      type="button"
                      onClick={isRecordingNow ? props.onStopRecording : props.onStartRecording}
                      aria-label={isRecordingNow ? t('common.stop') : 'Record your answer'}
                      className="relative w-20 h-20 rounded-full flex items-center justify-center text-white transition-transform duration-75 active:translate-y-1.5"
                      style={
                        isRecordingNow
                          ? { background: '#E62D2B', boxShadow: '0 6px 0 #A91E1C' }
                          : { background: ACCENT, boxShadow: `0 6px 0 ${ACCENT_DARK}` }
                      }
                    >
                      {isRecordingNow ? <Square size={26} fill="currentColor" /> : <Mic size={30} />}
                    </button>
                  </div>

                  {isRecordingNow ? (
                    <div className="flex flex-col items-center gap-2">
                      <Waveform />
                      <p className="text-sm font-bold text-red-500">
                        Keep talking! {Math.max(0, RECORDING_MAX_SECONDS - props.recordingSeconds)}s left
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm font-bold" style={{ color: ACCENT_DARK }}>Tap to talk</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
