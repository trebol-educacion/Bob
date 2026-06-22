'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Mic, Square, Volume2, RotateCcw, ChevronDown, ChevronUp, Check } from 'lucide-react';
import {
  generatePETDiscussionAction,
  processPETDiscussionAnswerAction,
  evaluatePETDiscussionAction,
  petDiscussionQuestions,
  type PETDiscussionPlan,
} from '@/actions/modes/pet-p4';
import { createSessionAction } from '@/actions/sessions';
import { blobToBase64 } from '@/lib/audio';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTTS } from '@/hooks/useTTS';
import type { FormativeFeedback } from '@/lib/types/practice';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { KETSpeakingIcon } from '@/components/icons/KETIcons';
import { useTranslations } from 'next-intl';

const ACCENT = '#3660AB';
const ACCENT_DARK = '#27497F';
const ACCENT_TINT = 'color-mix(in oklab, #3660AB 12%, white)';
const CARD_SURFACE = '#FAFAF8';
const RECORDING_MAX_SECONDS = 45;
const REACTION_PAUSE_MS = 900;

type Step = 'answer' | 'recording' | 'review' | 'processing' | 'transition';

interface QA {
  question: string;
  answer: string;
}

export interface PETDiscussionPracticeProps {
  onBack: () => void;
}

function FeedbackBlocks({ feedback }: { feedback: FormativeFeedback }) {
  const [modelOpen, setModelOpen] = useState(false);
  const highlights = feedback.highlights.length > 0 ? feedback.highlights : ['You spoke up — well done!'];
  const tip = feedback.suggestions.length > 0 ? feedback.suggestions[0] : null;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 space-y-1.5">
        <p className="text-xs font-bold text-green-800 inline-flex items-center gap-1">What you did well <Check className="w-3.5 h-3.5" /></p>
        {highlights.map((h, i) => (
          <p key={i} className="text-sm text-green-700 leading-snug">• {h}</p>
        ))}
      </div>
      {tip && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
          <p className="text-xs font-bold text-amber-800">Try next time</p>
          <p className="text-sm text-amber-700 leading-snug">• {tip}</p>
        </div>
      )}
      {feedback.model_answer && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setModelOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span>Example answer</span>
            {modelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <AnimatePresence>
            {modelOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                  <p className="text-sm text-gray-700 leading-relaxed italic">&quot;{feedback.model_answer}&quot;</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function PlaybackPlayer({ url }: { url: string }) {
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

function Waveform() {
  const reduceMotion = useReducedMotion();
  const bars = [0, 1, 2, 3, 4];
  return (
    <div className="flex items-end gap-1 h-6" aria-hidden>
      {bars.map((i) => (
        <motion.span
          key={i}
          className="w-1.5 rounded-full bg-red-500"
          initial={{ height: 6 }}
          animate={reduceMotion ? { height: 14 } : { height: [6, 22, 6] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }}
        />
      ))}
    </div>
  );
}

function ProgressDots({ total, currentIndex }: { total: number; currentIndex: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-center">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <span key={i} className="relative inline-flex">
            {current && !reduceMotion && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{ background: ACCENT }}
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: [1, 1.9], opacity: [0.4, 0] }}
                transition={{ duration: 1.4, ease: 'easeOut', repeat: Infinity }}
              />
            )}
            <span
              className="relative w-2.5 h-2.5 rounded-full transition-colors"
              style={
                done
                  ? { background: ACCENT }
                  : current
                    ? { background: 'white', boxShadow: `inset 0 0 0 2px ${ACCENT}` }
                    : { background: '#E5E7EB' }
              }
            />
          </span>
        );
      })}
    </div>
  );
}

/** Cambridge B1 PET Speaking Part 4 — kid-first focus-mode discussion about an everyday topic. */
export function PETDiscussionPractice({ onBack }: PETDiscussionPracticeProps) {
  const t = useTranslations('cambridge');
  const reduceMotion = useReducedMotion();

  const [ready, setReady] = useState(false);
  const [plan, setPlan] = useState<PETDiscussionPlan | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [step, setStep] = useState<Step>('answer');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [currentReaction, setCurrentReaction] = useState('');
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [qas, setQas] = useState<QA[]>([]);
  const [evaluation, setEvaluation] = useState<FormativeFeedback | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [hearingQuestion, setHearingQuestion] = useState(false);

  const sessionIdRef = useRef<string>('');
  const userIdRef = useRef<string>('');
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);

  const { start: startTTS, stop: stopTTS } = useTTS();

  const currentQuestion = questions[questionIndex] ?? '';

  function stopTimer() {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  const handleRecorded = useCallback((blob: Blob) => {
    stopTimer();
    recordedBlobRef.current = blob;
    setPlaybackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return blob.size > 0 ? URL.createObjectURL(blob) : null;
    });
    setStep('review');
  }, []);

  const handleRecorderError = useCallback((err: Error) => {
    stopTimer();
    const denied = /denied|permission|notallowed|notfound|getusermedia/i.test(err.name + err.message);
    if (denied) {
      setMicDenied(true);
      return;
    }
    setError(err.message);
  }, []);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecorded: handleRecorded,
    onError: handleRecorderError,
  });

  useEffect(() => () => {
    stopTimer();
    setPlaybackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const startSession = useCallback(async () => {
    try {
      const sessionResult = await createSessionAction({ mode: 'cambridge_pet_p4', title: 'B1 Speaking – Part 4' });
      if (!sessionResult.data) throw new Error(sessionResult.error ?? 'Failed to create session');
      sessionIdRef.current = sessionResult.data.id;
      userIdRef.current = sessionResult.data.user_id;
      const sessionPlan = await generatePETDiscussionAction(sessionIdRef.current, userIdRef.current);
      setPlan(sessionPlan);
      setQuestions(petDiscussionQuestions(sessionPlan));
      setStep('answer');
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  }, []);

  useEffect(() => {
    void startSession();
  }, [startSession]);

  const advanceToNext = useCallback(() => {
    const nextIndex = questionIndex + 1;
    if (nextIndex >= questions.length) {
      setEvaluating(true);
      return;
    }
    setQuestionIndex(nextIndex);
    setCurrentReaction('');
    setStep('answer');
  }, [questionIndex, questions.length]);

  async function handleStartRecording() {
    if (!plan) return;
    stopTTS();
    setHearingQuestion(false);
    setError(null);
    setRecordingSeconds(0);
    recordedBlobRef.current = null;
    setStep('recording');
    await startRecording();
    let elapsed = 0;
    recordingTimerRef.current = setInterval(() => {
      elapsed += 1;
      setRecordingSeconds(elapsed);
      if (elapsed >= RECORDING_MAX_SECONDS) {
        stopTimer();
        stopRecording();
      }
    }, 1000);
  }

  function handleStopRecording() {
    stopTimer();
    stopRecording();
  }

  function handleRetry() {
    setPlaybackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    recordedBlobRef.current = null;
    setError(null);
    setStep('answer');
  }

  async function handleHearQuestion() {
    if (hearingQuestion) {
      stopTTS();
      setHearingQuestion(false);
      return;
    }
    setHearingQuestion(true);
    await startTTS(currentQuestion);
  }

  async function handleSend() {
    const blob = recordedBlobRef.current;
    setStep('processing');
    try {
      let transcribed = '';
      let reaction = '';
      if (blob && blob.size > 0) {
        const audioBase64 = await blobToBase64(blob);
        const result = await processPETDiscussionAnswerAction(
          audioBase64,
          blob.type || 'audio/webm',
          currentQuestion,
          sessionIdRef.current,
          userIdRef.current,
        );
        transcribed = result.transcribed;
        reaction = result.reaction;
      }
      setQas((prev) => [...prev, { question: currentQuestion, answer: transcribed }]);
      setCurrentReaction(reaction);
      setStep('transition');
      if (reaction) void startTTS(reaction);
      await new Promise<void>((resolve) => setTimeout(resolve, reaction ? REACTION_PAUSE_MS : 350));
      advanceToNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing error');
      setStep('review');
    }
  }

  useEffect(() => {
    if (!evaluating) return;
    void (async () => {
      try {
        const result = await evaluatePETDiscussionAction(qas, sessionIdRef.current, userIdRef.current);
        setEvaluation(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Evaluation failed');
      } finally {
        setEvaluating(false);
      }
    })();
  }, [evaluating, qas]);

  function handleTryAgain() {
    stopTTS();
    setReady(false);
    setPlan(null);
    setQuestions([]);
    setQuestionIndex(0);
    setStep('answer');
    setQas([]);
    setEvaluation(null);
    setEvaluating(false);
    setError(null);
    setMicDenied(false);
    setCurrentReaction('');
    setPlaybackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    void startSession();
  }

  const totalQuestions = questions.length;
  const isRecordingNow = step === 'recording' && isRecording;

  const header = (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
      <button
        type="button"
        onClick={onBack}
        className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 text-lg"
        aria-label={t('common.back')}
      >
        ←
      </button>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT_TINT, color: ACCENT }}>
        <KETSpeakingIcon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">Speaking · Part 4: Discussion</p>
        <p className="text-xs text-gray-400">Cambridge B1 Preliminary</p>
      </div>
      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: ACCENT_TINT, color: ACCENT_DARK }}>
        B1
      </span>
    </div>
  );

  if (error && !micDenied) {
    return (
      <div className="flex flex-col h-full">
        {header}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
          <div className="mx-auto w-full max-w-lg rounded-3xl border border-gray-100 shadow-sm px-6 py-8 text-center space-y-4" style={{ background: CARD_SURFACE }}>
            <p className="text-red-500 font-semibold">{error}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleTryAgain}
                className="flex-1 px-5 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 active:translate-y-1"
                style={{ background: ACCENT, boxShadow: `0 4px 0 ${ACCENT_DARK}` }}
              >
                {t('common.tryAgain')}
              </button>
              <button
                type="button"
                onClick={onBack}
                className="flex-1 px-5 py-3 rounded-2xl text-sm font-bold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              >
                {t('common.back')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return <BobMascotLoader message="Getting your discussion ready…" />;
  }

  if (evaluating) {
    return <BobMascotLoader message={t('common.evaluatingPerformance')} />;
  }

  if (micDenied) {
    return (
      <div className="flex flex-col h-full">
        {header}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto w-full max-w-lg">
            <div className="rounded-3xl border border-gray-100 shadow-sm px-6 py-8 text-center space-y-4" style={{ background: CARD_SURFACE }}>
              <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: ACCENT_TINT, color: ACCENT }}>
                <Mic size={28} />
              </div>
              <p className="text-lg font-bold text-gray-800">We can&apos;t hear you yet</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                Ask an adult to turn on the microphone for this page, then try again.
              </p>
              <button
                type="button"
                onClick={() => { setMicDenied(false); setStep('answer'); }}
                className="px-6 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 active:translate-y-1"
                style={{ background: ACCENT, boxShadow: `0 4px 0 ${ACCENT_DARK}` }}
              >
                {t('common.tryAgain')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (evaluation) {
    return (
      <div className="flex flex-col h-full">
        {header}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full max-w-lg space-y-5"
          >
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-black text-gray-900">Discussion complete!</h2>
              <p className="text-sm text-gray-400 font-medium">Cambridge B1 · Part 4</p>
            </div>

            <FeedbackBlocks feedback={evaluation} />

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleTryAgain}
                className="flex-1 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 active:translate-y-1"
                style={{ background: ACCENT, boxShadow: `0 4px 0 ${ACCENT_DARK}` }}
              >
                {t('common.tryAgain')}
              </button>
              <button
                type="button"
                onClick={onBack}
                className="flex-1 py-3 rounded-2xl text-sm font-bold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              >
                {t('common.backToModes')}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const questionNumber = questionIndex + 1;

  return (
    <div className="flex flex-col h-full">
      {header}

      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="mx-auto w-full max-w-lg flex flex-col items-center gap-2">
          <ProgressDots total={totalQuestions} currentIndex={questionIndex} />
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            {questionNumber}/{totalQuestions}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="mx-auto w-full max-w-lg flex flex-col gap-4">
          {plan && questionIndex === 0 && (
            <div className="rounded-2xl border px-4 py-3" style={{ background: ACCENT_TINT, borderColor: 'transparent' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ACCENT_DARK }}>Topic</p>
              <p className="text-sm font-bold" style={{ color: ACCENT_DARK }}>{plan.topic}</p>
              {plan.link && <p className="mt-1 text-xs text-gray-500 leading-snug">{plan.link}</p>}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={`question-${questionIndex}`}
              initial={reduceMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="rounded-3xl border border-gray-100 shadow-sm px-5 py-6" style={{ background: CARD_SURFACE }}
            >
              <p className="text-xl font-bold text-gray-900 leading-snug">{currentQuestion || '…'}</p>
              <button
                type="button"
                onClick={handleHearQuestion}
                className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold transition-transform active:scale-95"
                style={{ background: ACCENT_TINT, color: ACCENT_DARK }}
              >
                <Volume2 size={14} />
                {hearingQuestion ? 'Stop' : 'Hear the question'}
              </button>
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-col items-center gap-3 pt-1">
            <AnimatePresence mode="wait">
              {step === 'review' && playbackUrl ? (
                <motion.div
                  key="review"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  className="w-full flex flex-col gap-3"
                >
                  <PlaybackPlayer url={playbackUrl} />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-gray-600 border border-gray-200 bg-white transition-colors hover:bg-gray-50"
                    >
                      <RotateCcw size={16} />
                      {t('common.tryAgain')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSend}
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
                      onClick={isRecordingNow ? handleStopRecording : handleStartRecording}
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
                        Keep talking! {Math.max(0, RECORDING_MAX_SECONDS - recordingSeconds)}s left
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
