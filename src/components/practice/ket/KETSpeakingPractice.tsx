'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Mic, Square, Volume2, ChevronDown, ChevronUp, RotateCcw, Check, X } from 'lucide-react';
import { KETSpeakingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { pcmToWavBase64, blobToBase64 } from '@/lib/audio';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

const ACCENT = '#3660AB';
const ACCENT_DARK = '#27497F';
const ACCENT_TINT = 'color-mix(in oklab, #3660AB 12%, white)';
const CARD_SURFACE = '#FAFAF8';

export type SpeakingRubric = {
  task_coverage: number;
  grammar: number;
  vocabulary: number;
  fluency: number;
};

export type SpeakingFeedback = {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  model_answer: string | null;
  rubric?: SpeakingRubric;
};

export interface KETSpeakingPracticeProps {
  /** Header label shown to student */
  partLabel: string;
  /** Activity title e.g. "Talk About a Hobby" */
  title: string;
  /** Seconds allowed to record */
  recordingSeconds: number;
  /** Bob's spoken instruction (TTS audio) */
  instructionAudioB64: string;
  instructionAudioMime: string;
  /** Written instruction shown on screen */
  instructionText: string;
  /** Optional bullet points to help student */
  bulletPoints?: string[];
  /** Main image for the exercise */
  imageUrl?: string;
  /** True while TTS/image are still loading in the background (two-phase). */
  mediaLoading?: boolean;
  /** True if this activity requires the image before the student can start. */
  imageRequired?: boolean;
  /** Called with { audioBase64, audioMime } when student stops recording */
  onSubmit: (audio: { base64: string; mime: string }) => Promise<SpeakingFeedback | { error: string }>;
  onBack: () => void;
  onOpenDashboard?: () => void;
}

type Phase =
  | 'ready'
  | 'recording'
  | 'review'
  | 'evaluating'
  | 'finished'
  | 'mic-denied';

function rubricTotal(rubric: SpeakingRubric): number {
  return rubric.task_coverage + rubric.grammar + rubric.vocabulary + rubric.fluency;
}

function InstructionAudioButton({ audioB64, audioMime }: { audioB64: string; audioMime: string }) {
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  function play() {
    if (playing) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlaying(false);
      return;
    }
    const url = pcmToWavBase64(audioB64, audioMime);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { audioRef.current = null; setPlaying(false); };
    audio.onerror = () => { audioRef.current = null; setPlaying(false); };
    setPlaying(true);
    audio.play().catch(() => { audioRef.current = null; setPlaying(false); });
  }

  return (
    <button
      type="button"
      onClick={play}
      aria-label="Hear this"
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
      <Volume2 size={16} className="relative" />
    </button>
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

function FeedbackBlocks({ feedback }: { feedback: SpeakingFeedback }) {
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
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
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

/** Shared kid-first speaking practice component for KET Parts 2 and 3. */
export function KETSpeakingPractice({
  partLabel,
  title,
  recordingSeconds,
  instructionAudioB64,
  instructionAudioMime,
  instructionText,
  bulletPoints,
  imageUrl,
  mediaLoading = false,
  imageRequired = false,
  onSubmit,
  onBack,
  onOpenDashboard,
}: KETSpeakingPracticeProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('ready');
  const [secondsLeft, setSecondsLeft] = useState(recordingSeconds);
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const pendingBlobRef = useRef<Blob | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  const handleRecorded = useCallback((blob: Blob) => {
    stopCountdown();
    pendingBlobRef.current = blob;
    setPlaybackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setPhase('review');
  }, []);

  const handleRecorderError = useCallback((error: Error) => {
    const denied = /denied|permission|notallowed|notfound|getusermedia/i.test(error.name + error.message);
    if (denied) {
      setPhase('mic-denied');
      return;
    }
    setErrorMsg(error.message);
    setPhase('ready');
  }, []);

  const { startRecording, stopRecording } = useAudioRecorder({
    onRecorded: handleRecorded,
    onError: handleRecorderError,
  });

  useEffect(() => () => {
    stopCountdown();
    setPlaybackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  async function handleStartRecording() {
    setErrorMsg(null);
    setSecondsLeft(recordingSeconds);
    setPhase('recording');
    await startRecording();
    let remaining = recordingSeconds;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        stopCountdown();
        stopRecording();
      }
    }, 1000);
  }

  function handleStopRecording() {
    stopCountdown();
    stopRecording();
  }

  function handleRetry() {
    setPlaybackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    pendingBlobRef.current = null;
    setPhase('ready');
  }

  async function handleSend() {
    const blob = pendingBlobRef.current;
    if (!blob) return;
    setPhase('evaluating');
    const base64 = await blobToBase64(blob);
    const result = await onSubmit({ base64, mime: blob.type || 'audio/webm;codecs=opus' });
    if ('error' in result) {
      setErrorMsg(result.error);
      setPhase('review');
      return;
    }
    setFeedback(result);
    setPhase('finished');
  }

  const micBlocked = imageRequired && mediaLoading;

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 text-lg"
          aria-label="Back"
        >
          ←
        </button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT_TINT, color: ACCENT }}>
          <KETSpeakingIcon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{title}</p>
          <p className="text-xs text-gray-400">Speaking · {partLabel}</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: ACCENT_TINT, color: ACCENT_DARK }}>
          A2
        </span>
      </div>

      {phase === 'evaluating' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Listening to your answer…" />
        </div>
      )}

      {phase === 'mic-denied' && (
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
                onClick={() => setPhase('ready')}
                className="px-6 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 active:translate-y-1"
                style={{ background: ACCENT, boxShadow: `0 4px 0 ${ACCENT_DARK}` }}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {(phase === 'ready' || phase === 'recording' || phase === 'review') && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto w-full max-w-lg flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-3xl border border-gray-100 shadow-sm px-4 py-3" style={{ background: CARD_SURFACE }}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT_TINT, color: ACCENT }}>
                <KETSpeakingIcon size={20} />
              </span>
              <p className="text-sm text-gray-700 leading-relaxed flex-1">{instructionText}</p>
              {instructionAudioB64 && (
                <InstructionAudioButton audioB64={instructionAudioB64} audioMime={instructionAudioMime} />
              )}
            </div>

            {imageUrl ? (
              <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm w-full">
                <div className="relative w-full bg-gray-50" style={{ paddingBottom: '60%' }}>
                  <Image src={imageUrl} alt="Speaking prompt" fill sizes="(max-width: 640px) 100vw, 512px" className="object-contain" unoptimized={imageUrl.startsWith('data:')} />
                </div>
              </div>
            ) : (imageRequired && mediaLoading) ? (
              <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                <div className="relative w-full" style={{ paddingBottom: '60%' }}>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 animate-spin" style={{ color: ACCENT }}>
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    <p className="text-xs font-semibold text-gray-400">Preparing the picture…</p>
                  </div>
                </div>
              </div>
            ) : null}

            {bulletPoints && bulletPoints.length > 0 && (
              <div className="rounded-3xl border border-gray-100 shadow-sm px-4 py-3 space-y-2" style={{ background: CARD_SURFACE }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT_DARK }}>Talk about…</p>
                {bulletPoints.map((bp, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5" style={{ background: ACCENT_TINT, color: ACCENT }}>{i + 1}</span>
                    <span className="text-lg font-bold text-gray-800 leading-snug">{bp}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col items-center gap-3 pt-2">
              <AnimatePresence mode="wait">
                {phase === 'review' && playbackUrl ? (
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
                        Try again
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
                ) : (
                  <motion.div
                    key="record"
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="relative w-24 h-24 flex items-center justify-center">
                      {phase === 'recording' && !reduceMotion && (
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
                        onClick={phase === 'recording' ? handleStopRecording : handleStartRecording}
                        disabled={micBlocked}
                        aria-label={phase === 'recording' ? 'Stop' : 'Tap to talk'}
                        className="relative w-20 h-20 rounded-full flex items-center justify-center text-white transition-transform duration-75 active:translate-y-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={
                          phase === 'recording'
                            ? { background: '#E62D2B', boxShadow: '0 6px 0 #A91E1C' }
                            : { background: ACCENT, boxShadow: `0 6px 0 ${ACCENT_DARK}` }
                        }
                      >
                        {phase === 'recording' ? <Square size={26} fill="currentColor" /> : <Mic size={30} />}
                      </button>
                    </div>

                    {phase === 'recording' ? (
                      <div className="flex flex-col items-center gap-2">
                        <Waveform />
                        <p className="text-sm font-bold text-red-500">
                          Keep talking! {Math.max(0, secondsLeft)}s left
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm font-bold" style={{ color: ACCENT_DARK }}>
                        {micBlocked ? 'Preparing picture…' : 'Tap to talk'}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-4" />
          </div>
        </div>
      )}

      {phase === 'finished' && feedback && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto w-full max-w-lg space-y-4">
            {imageUrl && (
              <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm w-full">
                <div className="relative w-full bg-gray-50" style={{ paddingBottom: '40%' }}>
                  <Image src={imageUrl} alt="Speaking prompt" fill sizes="(max-width: 640px) 100vw, 512px" className="object-contain" unoptimized={imageUrl.startsWith('data:')} />
                </div>
              </div>
            )}

            <FeedbackBlocks feedback={feedback} />

            <div className="flex justify-center pt-2">
              {feedback.rubric ? (
                <CelebrationCard
                  score={rubricTotal(feedback.rubric)}
                  scoreMax={16}
                  feedback="Great speaking practice!"
                  onAction={onOpenDashboard}
                  actionLabel="See my progress"
                  animate={true}
                />
              ) : (
                <CelebrationCard
                  score={feedback.understood ? 1 : 0}
                  scoreMax={1}
                  feedback="Great speaking practice!"
                  onAction={onOpenDashboard}
                  actionLabel="See my progress"
                  animate={true}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {errorMsg && phase !== 'mic-denied' && (
        <div className="absolute inset-x-4 bottom-24 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-600">{errorMsg}</p>
          <button type="button" onClick={() => setErrorMsg(null)} aria-label="Dismiss" className="text-red-400 ml-2"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
