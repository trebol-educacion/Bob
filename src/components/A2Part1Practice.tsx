'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Mic, Square, Volume2, RotateCcw, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { generateA2SessionAction, processA2AnswerAction, evaluateA2FinalAction } from '@/actions/modes/a2';
import { createSessionAction } from '@/actions/sessions';
import { blobToBase64 } from '@/lib/audio';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTTS } from '@/hooks/useTTS';
import type { A2SessionPlan } from '@/actions/modes/a2';
import type { FormativeFeedback, RubricCriteria } from '@/lib/types/practice';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { KETSpeakingIcon } from '@/components/icons/KETIcons';
import { useTranslations } from 'next-intl';

const ACCENT = '#3660AB';
const ACCENT_DARK = '#27497F';
const ACCENT_TINT = 'color-mix(in oklab, #3660AB 12%, white)';
const CARD_SURFACE = '#FAFAF8';
const RUBRIC_MAX = 16;

type A2Phase =
  | 'loading'
  | 'phase1'
  | 'phase2-topic1'
  | 'phase2-topic2'
  | 'final-question'
  | 'evaluating'
  | 'finished';

type QuestionStep = 'answer' | 'recording' | 'review' | 'processing' | 'transition';

interface QA {
  question: string;
  answer: string;
}

export interface A2Part1PracticeProps {
  onBack: () => void;
}

const RECORDING_MAX_SECONDS = 30;
const REACTION_PAUSE_MS = 900;

function rubricTotal(rubric: RubricCriteria): number {
  return rubric.task_coverage + rubric.grammar + rubric.vocabulary + rubric.fluency;
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
            <span>Model answer</span>
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

/** A2 Key Part 1 Speaking practice — kid-first focus-mode Cambridge KET interview. */
export function A2Part1Practice({ onBack }: A2Part1PracticeProps) {
  const t = useTranslations('cambridge');
  const reduceMotion = useReducedMotion();

  const [phase, setPhase] = useState<A2Phase>('loading');
  const [plan, setPlan] = useState<A2SessionPlan | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionStep, setQuestionStep] = useState<QuestionStep>('answer');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentReaction, setCurrentReaction] = useState('');
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [qas, setQas] = useState<QA[]>([]);
  const [evaluation, setEvaluation] = useState<FormativeFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [hearingQuestion, setHearingQuestion] = useState(false);

  const sessionIdRef = useRef<string>('');
  const userIdRef = useRef<string>('');
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);

  const { play: playTTS, stop: stopCurrentAudio } = useTTS();

  const getAllQuestions = useCallback((p: A2SessionPlan): string[] => {
    return [
      ...p.phase1_questions,
      ...p.topic1_questions,
      ...p.topic2_questions,
      p.final_question,
    ];
  }, []);

  const getPhaseForIndex = useCallback((idx: number): A2Phase => {
    if (idx < 3) return 'phase1';
    if (idx < 7) return 'phase2-topic1';
    if (idx < 10) return 'phase2-topic2';
    return 'final-question';
  }, []);

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
    setQuestionStep('review');
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
      const sessionResult = await createSessionAction({ mode: 'cambridge_ket_part1', title: 'A2 Speaking – Part 1' });
      if (!sessionResult.data) throw new Error(sessionResult.error ?? 'Failed to create session');
      sessionIdRef.current = sessionResult.data.id;
      userIdRef.current = sessionResult.data.user_id;
      const sessionPlan = await generateA2SessionAction(sessionIdRef.current, userIdRef.current);
      setPlan(sessionPlan);
      setCurrentQuestion(getAllQuestions(sessionPlan)[0]);
      setQuestionStep('answer');
      setPhase('phase1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  }, [getAllQuestions]);

  useEffect(() => {
    void startSession();
  }, [startSession]);

  const advanceToNext = useCallback(() => {
    if (!plan) return;
    const questions = getAllQuestions(plan);
    const nextIndex = questionIndex + 1;

    if (nextIndex >= questions.length) {
      setPhase('evaluating');
      return;
    }

    setCurrentQuestion(questions[nextIndex]);
    setCurrentReaction('');
    setQuestionIndex(nextIndex);
    setPhase(getPhaseForIndex(nextIndex));
    setQuestionStep('answer');
  }, [plan, questionIndex, getAllQuestions, getPhaseForIndex]);

  async function handleStartRecording() {
    if (!plan) return;
    stopCurrentAudio();
    setHearingQuestion(false);
    setError(null);
    setRecordingSeconds(0);
    recordedBlobRef.current = null;
    setQuestionStep('recording');
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
    setQuestionStep('answer');
  }

  async function handleHearQuestion() {
    if (hearingQuestion) {
      stopCurrentAudio();
      setHearingQuestion(false);
      return;
    }
    setHearingQuestion(true);
    await playTTS(currentQuestion, { onError: () => setHearingQuestion(false) });
    setHearingQuestion(false);
  }

  async function handleSend() {
    const blob = recordedBlobRef.current;
    setQuestionStep('processing');
    try {
      let transcribed = '';
      let reaction = '';
      if (blob && blob.size > 0) {
        const audioBase64 = await blobToBase64(blob);
        const result = await processA2AnswerAction(
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
      setQuestionStep('transition');
      await new Promise<void>((resolve) => setTimeout(resolve, reaction ? REACTION_PAUSE_MS : 350));
      advanceToNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing error');
      setQuestionStep('review');
    }
  }

  useEffect(() => {
    if (phase !== 'evaluating') return;
    void (async () => {
      try {
        const result = await evaluateA2FinalAction(qas, sessionIdRef.current, userIdRef.current);
        setEvaluation(result);
        setPhase('finished');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Evaluation failed');
      }
    })();
  }, [phase, qas]);

  function handleTryAgain() {
    stopCurrentAudio();
    setPlan(null);
    setPhase('loading');
    setQuestionIndex(0);
    setQuestionStep('answer');
    setQas([]);
    setEvaluation(null);
    setError(null);
    setMicDenied(false);
    setCurrentQuestion('');
    setCurrentReaction('');
    setPlaybackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    void startSession();
  }

  const totalQuestions = 11;

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
        <p className="text-sm font-bold text-gray-800 truncate">{t('a2.part1.headerTitle')}</p>
        <p className="text-xs text-gray-400">Speaking · {t('a2.part1.subtitle')}</p>
      </div>
      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: ACCENT_TINT, color: ACCENT_DARK }}>
        A2
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

  if (phase === 'loading') {
    return <BobMascotLoader message={t('a2.part1.preparingInterview')} />;
  }

  if (phase === 'evaluating') {
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
                onClick={() => { setMicDenied(false); setQuestionStep('answer'); }}
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

  if (phase === 'finished' && evaluation) {
    const rubric = evaluation.rubric;
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
              <h2 className="text-2xl font-black text-gray-900">{t('a2.part1.interviewComplete')}</h2>
              <p className="text-sm text-gray-400 font-medium">{t('a2.part1.subtitle')}</p>
            </div>

            <div className="flex justify-center">
              {rubric ? (
                <CelebrationCard
                  score={rubricTotal(rubric)}
                  scoreMax={RUBRIC_MAX}
                  feedback="Great speaking practice!"
                  animate={!reduceMotion}
                />
              ) : (
                <CelebrationCard
                  score={evaluation.understood ? 1 : 0}
                  scoreMax={1}
                  feedback="Great speaking practice!"
                  animate={!reduceMotion}
                />
              )}
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
  const isRecordingNow = questionStep === 'recording' && isRecording;

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
              {questionStep === 'review' && playbackUrl ? (
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
              ) : questionStep === 'processing' || questionStep === 'transition' ? (
                <motion.div
                  key="processing"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  className="flex flex-col items-center gap-3 py-4"
                >
                  {questionStep === 'transition' && currentReaction ? (
                    <p className="text-sm font-bold text-center px-2" style={{ color: ACCENT_DARK }}>
                      {currentReaction}
                    </p>
                  ) : (
                    <>
                      <div
                        className="w-8 h-8 border-2 rounded-full animate-spin"
                        style={{ borderColor: ACCENT, borderTopColor: 'transparent' }}
                      />
                      <p className="text-sm font-semibold text-gray-400">{t('a2.part1.processingAnswer')}</p>
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
                      aria-label={isRecordingNow ? t('common.stop') : t('a2.part1.recording')}
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
