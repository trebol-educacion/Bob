'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { XCircle } from 'lucide-react';
import { KETListeningIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import { pcmToWavBase64 } from '@/lib/audio';
import {
  generateKETListenCompleteAction,
  generateKETListenCompleteAudioAction,
  submitKETListenCompleteAction,
  type ListenCompleteExercise,
  type GapResult,
} from '@/actions/modes/ket-listening-part2';
import type { StoredMessage } from '@/actions/messages';

const ACCENT = '#F8AC37';
const ACCENT_DARK = '#D8881C';
const ACCENT_TEXT = '#B5710F';
const ACCENT_TINT = 'color-mix(in oklab, #F8AC37 14%, white)';
const CARD_SURFACE = '#FAFAF8';

export interface KETListenAndCompletePracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';

interface RestoredState {
  exercise: ListenCompleteExercise;
  framingText: string;
  gapResults: GapResult[] | null;
  correctCount: number;
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let exercise: ListenCompleteExercise | null = null;
  let framingText = '';
  let gapResults: GapResult[] | null = null;
  let correctCount = 0;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'listen_complete_plan') {
      const raw = cj.exercise as ListenCompleteExercise;
      exercise = { ...raw, audio_b64: '', audio_mime: 'audio/L16;codec=pcm;rate=24000' };
      framingText = String(cj.framing_text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      gapResults = cj.gap_results as GapResult[];
      correctCount = Number(cj.score ?? 0);
    }
  }

  if (exercise) return { exercise, framingText, gapResults, correctCount };
  return null;
}

let _activeAudio: HTMLAudioElement | null = null;

function stopActiveAudio() {
  if (_activeAudio) {
    _activeAudio.pause();
    _activeAudio.src = '';
    _activeAudio = null;
  }
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 10 9 10" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

type AudioStatus = 'loading' | 'ready' | 'error';

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function AudioPlayer({
  audiob64,
  audiomime,
  status,
}: {
  audiob64: string;
  audiomime: string;
  status: AudioStatus;
}) {
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopLocal = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
    if (_activeAudio === audioRef.current) _activeAudio = null;
  };

  useEffect(() => () => stopLocal(), []);

  const handlePlay = async () => {
    if (playing) {
      stopLocal();
      setProgress(0);
      return;
    }

    stopActiveAudio();

    const url = pcmToWavBase64(audiob64, audiomime);
    const audio = new Audio(url);
    audioRef.current = audio;
    _activeAudio = audio;

    audio.onended = () => {
      stopLocal();
      setHasPlayed(true);
      setProgress(1);
      setTimeout(() => setProgress(0), 600);
    };
    audio.onerror = () => stopLocal();

    setPlaying(true);
    intervalRef.current = setInterval(() => {
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
    }, 100);

    try {
      await audio.play();
    } catch {
      stopLocal();
    }
  };

  if (status === 'error') {
    return (
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm pb-2 pt-4">
        <div className="rounded-full ring-1 ring-gray-100 bg-gray-50 px-3 py-2 flex items-center gap-3 h-12">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-200 text-gray-400">
            <PlayIcon />
          </div>
          <p className="flex-1 text-sm font-semibold text-gray-400">Audio unavailable</p>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm pb-2 pt-4">
        <div className="rounded-full ring-1 ring-sky-100 bg-sky-50 px-3 py-2 flex items-center gap-3 h-12">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white opacity-60"
            style={{ background: ACCENT }}
            aria-hidden
          >
            <Spinner />
          </div>
          <p className="flex-1 text-xs font-semibold" style={{ color: ACCENT_TEXT }}>Preparing audio…</p>
        </div>
      </div>
    );
  }

  const label = playing ? 'Playing…' : hasPlayed ? 'Listen again' : 'Listen';

  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm pb-2 pt-4">
      <div className="relative rounded-full ring-1 ring-sky-100 bg-sky-50 px-3 py-2 flex items-center gap-3 h-12 overflow-hidden">
        <div className="relative shrink-0 w-10 h-10">
          {playing && (
            <motion.div
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ background: ACCENT }}
              initial={{ scale: 1, opacity: 0.4 }}
              animate={reduceMotion ? { scale: 1, opacity: 0.25 } : { scale: [1, 1.6], opacity: [0.4, 0] }}
              transition={reduceMotion ? { duration: 0 } : { duration: 1.2, ease: 'easeOut', repeat: Infinity }}
            />
          )}
          <button
            type="button"
            onClick={handlePlay}
            aria-label={label}
            className="relative w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 text-white"
            style={{ background: ACCENT }}
          >
            {playing ? <PauseIcon /> : hasPlayed ? <ReplayIcon /> : <PlayIcon />}
          </button>
        </div>
        <p className="flex-1 text-xs font-semibold truncate" style={{ color: ACCENT_TEXT }}>{label}</p>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] bg-sky-200/60">
          <div
            className="h-full transition-all"
            style={{ width: `${Math.round(progress * 100)}%`, background: ACCENT }}
          />
        </div>
      </div>
    </div>
  );
}

function GapInput({
  gap,
  index,
  value,
  onChange,
  isLast,
  registerRef,
  onAdvance,
}: {
  gap: { number: number; label: string };
  index: number;
  value: string;
  onChange: (v: string) => void;
  isLast: boolean;
  registerRef: (index: number, el: HTMLInputElement | null) => void;
  onAdvance: (index: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const filled = value.trim() !== '';
  const wasFilledRef = useRef(filled);
  const [popKey, setPopKey] = useState(0);

  useEffect(() => {
    if (filled && !wasFilledRef.current) setPopKey((k) => k + 1);
    wasFilledRef.current = filled;
  }, [filled]);

  const badgeClass = filled ? 'bg-amber-400 text-white' : 'bg-amber-100 text-amber-300';
  const underlineColor = filled || focused ? ACCENT : '#E5E7EB';

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === ' ' || e.key === 'Enter') && value.trim() !== '') {
      e.preventDefault();
      onAdvance(index);
    }
  }

  return (
    <>
      <span
        className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center transition-colors duration-200 ${badgeClass}`}
      >
        {gap.number}
      </span>
      <span className="text-sm font-semibold text-gray-600 leading-tight">{gap.label}</span>
      <motion.div
        key={popKey}
        initial={false}
        animate={popKey > 0 && !reduceMotion ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 20 }}
        className="min-w-0"
      >
        <input
          ref={(el) => registerRef(index, el)}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="…"
          autoComplete="off"
          inputMode="text"
          enterKeyHint={isLast ? 'done' : 'next'}
          className="w-full bg-transparent border-0 border-b-2 px-1 py-0.5 text-base text-gray-800 placeholder-gray-300 focus:outline-none transition-colors duration-150 font-kalam"
          style={{ borderColor: underlineColor }}
        />
      </motion.div>
    </>
  );
}

function ResultCheck({ animate }: { animate: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-green-500 shrink-0" aria-hidden>
      <motion.path
        d="M5 13l4 4L19 7"
        initial={animate ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </svg>
  );
}

function GapResultRow({ result, animate }: { result: GapResult; animate: boolean }) {
  const correct = result.is_correct;
  const badgeClass = correct ? 'bg-green-400 text-white' : 'bg-rose-400 text-white';
  const underlineColor = correct ? '#4ade80' : '#fb7185';

  return (
    <>
      <span
        className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center transition-colors duration-200 ${badgeClass}`}
      >
        {result.number}
      </span>
      <span className="text-sm font-semibold text-gray-600 leading-tight">{result.label}</span>
      <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="border-b-2 px-1 py-0.5 inline-flex items-center gap-1 font-kalam"
          style={{ borderColor: underlineColor }}
        >
          {correct ? (
            <>
              <span className="text-base text-green-700 font-semibold">{result.user_input || '—'}</span>
              <ResultCheck animate={animate} />
            </>
          ) : (
            <span className="text-base text-rose-500 line-through">{result.user_input || '—'}</span>
          )}
        </span>
        {!correct && (
          <>
            <XCircle size={16} className="text-rose-400 shrink-0" />
            <motion.span
              initial={animate ? { x: -8, opacity: 0 } : false}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              className="bg-green-50 text-green-700 rounded-full px-2 py-0.5 text-sm font-semibold"
            >
              {result.correct_answer}
            </motion.span>
          </>
        )}
      </div>
    </>
  );
}

/** KET Listening Part 2 — Listen and Complete practice component. */
export function KETListenAndCompletePractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETListenAndCompletePracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [exercise, setExercise] = useState<ListenCompleteExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [gapResults, setGapResults] = useState<GapResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('loading');
  const [audioB64, setAudioB64] = useState('');
  const [audioMime, setAudioMime] = useState('audio/L16;codec=pcm;rate=24000');
  const initStartedRef = useRef(false);
  const audioStartedRef = useRef(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const submitRef = useRef<HTMLButtonElement | null>(null);

  function registerInputRef(index: number, el: HTMLInputElement | null) {
    inputRefs.current[index] = el;
  }

  function focusNext(index: number) {
    const next = inputRefs.current[index + 1];
    if (next) {
      next.focus();
    } else {
      inputRefs.current[index]?.blur();
      submitRef.current?.focus();
    }
  }

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    async function init() {
      if (initialMessages && initialMessages.length > 0) {
        const restored = tryRestore(initialMessages);
        if (restored) {
          setExercise(restored.exercise);
          setFramingText(restored.framingText);
          if (restored.gapResults) {
            setGapResults(restored.gapResults);
            setCorrectCount(restored.correctCount);
            setPhase('finished');
          } else {
            const { createSupabaseBrowser } = await import('@/lib/supabase/browser-client');
            const { data: { user } } = await createSupabaseBrowser().auth.getUser();
            if (user) setUserId(user.id);
            setPhase('ready');
          }
          return;
        }
      }

      if (initialSessionId) return;

      setIsNewSession(true);
      setPhase('generating');

      const result = await generateKETListenCompleteAction({ sessionId: initialSessionId });

      if ('error' in result) {
        setErrorMsg(result.error);
        return;
      }

      onSessionCreated?.(result.sessionId);
      setSessionId(result.sessionId);
      setUserId(result.userId);
      setExercise(result.exercise);
      setFramingText(result.framing_text);
      setPhase('ready');
    }

    void init();
  }, []);

  useEffect(() => {
    if (audioStartedRef.current) return;
    const transcript = exercise?.transcript;
    if (!transcript) return;
    audioStartedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const audio = await generateKETListenCompleteAudioAction({ transcript });
        if (cancelled) return;
        if (audio.data) {
          setAudioB64(audio.data);
          setAudioMime(audio.mimeType);
          setAudioStatus('ready');
        } else {
          setAudioStatus('error');
        }
      } catch {
        if (!cancelled) setAudioStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [exercise?.transcript]);

  async function handleSubmit() {
    if (!sessionId || !userId || !exercise) return;
    stopActiveAudio();
    setPhase('submitting');

    const result = await submitKETListenCompleteAction({
      sessionId,
      userId,
      answers,
      exercise,
    });

    if ('error' in result) {
      setErrorMsg(result.error);
      setPhase('ready');
      return;
    }

    setGapResults(result.gap_results);
    setCorrectCount(result.correct_count);
    setPhase('finished');
    onSessionFinished?.();
  }

  const answeredCount = Object.values(answers).filter((v) => v.trim() !== '').length;
  const allAnswered = exercise ? answeredCount === exercise.gaps.length : false;
  const progressPct = exercise && exercise.gaps.length > 0 ? (answeredCount / exercise.gaps.length) * 100 : 0;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
        <p className="text-red-500 font-semibold">{errorMsg}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
        >
          Back
        </button>
      </div>
    );
  }

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
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: ACCENT_TINT, color: ACCENT }}
        >
          <KETListeningIcon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">Listen and Complete</p>
          <p className="text-xs text-gray-400">Listening · Part 2</p>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          A2
        </span>
      </div>

      {phase === 'ready' && (
        <div className="h-1.5 w-full bg-gray-100 shrink-0 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: ACCENT }}
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          />
        </div>
      )}

      {(phase === 'loading' || phase === 'generating') && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Preparing exercise…" />
        </div>
      )}

      {phase === 'submitting' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Checking your answers…" />
        </div>
      )}

      {phase === 'ready' && exercise && (
        <>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="mx-auto w-full max-w-lg space-y-4">
            <AudioPlayer audiob64={audioB64} audiomime={audioMime} status={audioStatus} />

            <div className="flex items-start gap-2">
              <BobAvatar />
              <div className="bg-gray-50 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-gray-700 leading-relaxed max-w-sm">
                {framingText}
              </div>
            </div>

            <motion.div
              initial={isNewSession ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div
                className="rounded-3xl px-4 py-4 border border-gray-100 shadow-sm"
                style={{ background: CARD_SURFACE }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
                  >
                    <PencilIcon />
                  </span>
                  <p className="text-sm font-bold text-gray-800">{exercise.form_title}</p>
                </div>
                <p className="text-xs text-gray-400 leading-tight mb-3">{exercise.context}</p>
                <div className="border-l-[3px] pl-4" style={{ borderColor: ACCENT }}>
                  <div className="grid grid-cols-[1.5rem_minmax(0,8.5rem)_1fr] items-center gap-x-3 gap-y-3.5">
                    {exercise.gaps.map((gap, i) => (
                      <GapInput
                        key={gap.number}
                        gap={gap}
                        index={i}
                        isLast={i === exercise.gaps.length - 1}
                        value={answers[gap.number] ?? ''}
                        onChange={(v) =>
                          setAnswers((prev) => ({ ...prev, [gap.number]: v }))
                        }
                        registerRef={registerInputRef}
                        onAdvance={focusNext}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="h-20" />
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <div className="mx-auto w-full max-w-lg flex items-center gap-3">
            <p className="text-xs font-semibold text-gray-500 flex-1">
              {answeredCount} of {exercise.gaps.length} answered
            </p>
            <button
              ref={submitRef}
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="px-6 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 cursor-pointer active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
              style={{ background: ACCENT, boxShadow: allAnswered ? `0 4px 0 ${ACCENT_DARK}` : 'none' }}
            >
              Check answers
            </button>
            </div>
          </div>
        </>
      )}

      {phase === 'finished' && exercise && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto w-full max-w-lg space-y-4">
          <motion.div
            initial={isNewSession ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className="rounded-3xl px-4 py-4 border border-gray-100 shadow-sm"
            style={{ background: CARD_SURFACE }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
              >
                <PencilIcon />
              </span>
              <p className="text-sm font-bold text-gray-800">{exercise.form_title}</p>
            </div>
            <p className="text-xs text-gray-400 leading-tight mb-3">{exercise.context}</p>
            <div className="border-l-[3px] pl-4" style={{ borderColor: ACCENT }}>
              <div className="grid grid-cols-[1.5rem_minmax(0,8.5rem)_1fr] items-center gap-x-3 gap-y-3.5">
                {gapResults.map((r, i) => (
                  <motion.div
                    key={r.number}
                    initial={isNewSession ? { opacity: 0, x: -6 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 26, delay: isNewSession ? i * 0.07 : 0 }}
                    className="grid grid-cols-subgrid col-span-3 items-center gap-x-3"
                  >
                    <GapResultRow result={r} animate={isNewSession} />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="flex justify-center pt-2">
            <CelebrationCard
              score={correctCount}
              scoreMax={exercise.gaps.length}
              feedback="Great listening practice!"
              onAction={onOpenDashboard}
              actionLabel="See my progress"
              animate={isNewSession}
            />
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
