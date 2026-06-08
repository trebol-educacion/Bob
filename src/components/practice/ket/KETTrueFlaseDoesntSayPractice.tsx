'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { KETListeningIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { pcmToWavBase64 } from '@/lib/audio';
import {
  generateKETTFDSAction,
  generateKETTFDSAudioAction,
  submitKETTFDSAction,
  type Verdict,
  type AudioTurn,
  type Statement,
  type StatementResult,
  type TFDSExercise,
} from '@/actions/modes/ket-listening-part5';
import type { StoredMessage } from '@/actions/messages';

const ACCENT = '#F8AC37';
const ACCENT_DARK = '#D8881C';
const ACCENT_TEXT = '#B5710F';
const ACCENT_TINT = 'color-mix(in oklab, #F8AC37 14%, white)';
const CARD_SURFACE = '#FAFAF8';

export interface KETTrueFalseDoesntSayPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';
type AudioStatus = 'loading' | 'ready' | 'error';

interface VerdictMeta {
  value: Verdict;
  primary: string;
  secondary: string;
  swatch: string;
  selBg: string;
  selBorder: string;
  selText: string;
}

const VERDICT_META: Record<Verdict, VerdictMeta> = {
  T: {
    value: 'T',
    primary: 'True',
    secondary: 'The speaker says so',
    swatch: 'bg-emerald-500',
    selBg: 'bg-emerald-50',
    selBorder: 'border-emerald-400',
    selText: 'text-emerald-800',
  },
  F: {
    value: 'F',
    primary: 'False',
    secondary: 'The speaker says different',
    swatch: 'bg-red-500',
    selBg: 'bg-red-50',
    selBorder: 'border-red-400',
    selText: 'text-red-700',
  },
  DS: {
    value: 'DS',
    primary: 'Not in the text',
    secondary: "Doesn't Say",
    swatch: 'bg-stone-400',
    selBg: 'bg-stone-100',
    selBorder: 'border-stone-400',
    selText: 'text-stone-700',
  },
};

const VERDICT_ORDER: Verdict[] = ['T', 'F', 'DS'];

function VerdictIcon({ verdict, size = 18 }: { verdict: Verdict; size?: number }) {
  if (verdict === 'T') return <Check size={size} strokeWidth={3.5} className="text-white" />;
  if (verdict === 'F') return <X size={size} strokeWidth={3.5} className="text-white" />;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className="text-white" aria-hidden>
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/** Compact 3-signal verdict badge (icon + color + word) used in results. */
function VerdictBadge({ verdict, struck }: { verdict: Verdict; struck?: boolean }) {
  const meta = VERDICT_META[verdict];
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border',
        meta.selBg,
        meta.selBorder,
        meta.selText,
        struck ? 'line-through opacity-70' : '',
      ].join(' ')}
    >
      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${meta.swatch}`}>
        <VerdictIcon verdict={verdict} size={11} />
      </span>
      {meta.primary}
    </span>
  );
}

interface RestoredState {
  exercise: TFDSExercise;
  framingText: string;
  statementResults: StatementResult[] | null;
  correctCount: number;
  audio: AudioTurn[];
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let exercise: TFDSExercise | null = null;
  let framingText = '';
  let statementResults: StatementResult[] | null = null;
  let correctCount = 0;
  let audio: AudioTurn[] = [];

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'tfds_plan') {
      const raw = cj.exercise as TFDSExercise;
      exercise = { ...raw, audio_b64: '', audio_mime: 'audio/L16;codec=pcm;rate=24000' };
      audio = raw.audio ?? [];
      framingText = String(cj.framing_text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      statementResults = cj.statement_results as StatementResult[];
      correctCount = Number(cj.score ?? 0);
      audio = (cj.audio as AudioTurn[]) ?? audio;
    }
  }

  if (exercise) return { exercise, framingText, statementResults, correctCount, audio };
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

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function AudioPill({
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
        <div className="rounded-full ring-1 bg-amber-50 px-3 py-2 flex items-center gap-3 h-12" style={{ borderColor: ACCENT_TINT }}>
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
      <div className="relative rounded-full ring-1 ring-amber-100 bg-amber-50 px-3 py-2 flex items-center gap-3 h-12 overflow-hidden">
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
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] bg-amber-200/60">
          <div
            className="h-full transition-all"
            style={{ width: `${Math.round(progress * 100)}%`, background: ACCENT }}
          />
        </div>
      </div>
    </div>
  );
}

function ProgressDots({
  statements,
  answers,
  current,
  onJump,
}: {
  statements: Statement[];
  answers: Record<number, Verdict | null>;
  current: number;
  onJump: (index: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {statements.map((s, i) => {
        const done = answers[s.number] != null;
        const isCurrent = i === current;
        return (
          <button
            key={s.number}
            type="button"
            onClick={() => onJump(i)}
            aria-label={`Statement ${i + 1}`}
            className="p-1.5 -m-1 cursor-pointer"
          >
            <span
              className="block w-3 h-3 rounded-full transition-all"
              style={
                done
                  ? { background: ACCENT }
                  : isCurrent
                    ? { background: 'white', boxShadow: `0 0 0 2.5px ${ACCENT}` }
                    : { background: '#E5E7EB' }
              }
            />
          </button>
        );
      })}
    </div>
  );
}

function VerdictCard({
  verdict,
  selected,
  onSelect,
  disabled,
  reduceMotion,
}: {
  verdict: Verdict;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
  reduceMotion: boolean;
}) {
  const meta = VERDICT_META[verdict];
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.98 }}
      className={[
        'relative w-full min-h-16 rounded-2xl border-2 px-4 py-3 flex items-center gap-3 text-left cursor-pointer transition-colors',
        selected ? `${meta.selBg} ${meta.selBorder}` : 'border-gray-100',
        disabled ? 'cursor-not-allowed' : '',
      ].join(' ')}
      style={
        selected
          ? { transform: 'translateY(2px)', boxShadow: 'none' }
          : { background: CARD_SURFACE, boxShadow: '0 3px 0 #e5e7eb' }
      }
    >
      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.swatch}`}>
        <VerdictIcon verdict={verdict} />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-base font-bold leading-tight ${selected ? meta.selText : 'text-gray-800'}`}>{meta.primary}</span>
        <span className="block text-xs text-gray-400 leading-tight">{meta.secondary}</span>
      </span>
      {selected && (
        <motion.span
          initial={reduceMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${meta.swatch}`}
        >
          <Check size={14} strokeWidth={3.5} className="text-white" />
        </motion.span>
      )}
    </motion.button>
  );
}

/** KET Listening Part 5 — True, False or Doesn't Say focus-mode practice component. */
export function KETTrueFalseDoesntSayPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETTrueFalseDoesntSayPracticeProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [exercise, setExercise] = useState<TFDSExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, Verdict | null>>({});
  const [statementResults, setStatementResults] = useState<StatementResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [audio, setAudio] = useState<AudioTurn[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [current, setCurrent] = useState(0);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('loading');
  const [audioB64, setAudioB64] = useState('');
  const [audioMime, setAudioMime] = useState('audio/L16;codec=pcm;rate=24000');
  const initStartedRef = useRef(false);
  const audioStartedRef = useRef(false);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    async function init() {
      if (initialMessages && initialMessages.length > 0) {
        const restored = tryRestore(initialMessages);
        if (restored) {
          setExercise(restored.exercise);
          setFramingText(restored.framingText);
          setAudio(restored.audio);
          if (restored.statementResults) {
            setStatementResults(restored.statementResults);
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

      const result = await generateKETTFDSAction({ sessionId: initialSessionId });

      if ('error' in result) {
        setErrorMsg(result.error);
        return;
      }

      onSessionCreated?.(result.sessionId);
      setSessionId(result.sessionId);
      setUserId(result.userId);
      setExercise(result.exercise);
      setFramingText(result.framing_text);
      setAudio(result.exercise.audio);
      setPhase('ready');
    }

    void init();
  }, []);

  useEffect(() => {
    if (audioStartedRef.current) return;
    if (phase !== 'ready') return;
    if (audio.length === 0) return;
    audioStartedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const generated = await generateKETTFDSAudioAction({ audio });
        if (cancelled) return;
        if (generated.data) {
          setAudioB64(generated.data);
          setAudioMime(generated.mimeType);
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
  }, [phase, audio]);

  useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current); }, []);

  function handlePick(statementNumber: number, verdict: Verdict, index: number, total: number) {
    setAnswers((prev) => ({ ...prev, [statementNumber]: verdict }));
    if (advanceRef.current) clearTimeout(advanceRef.current);
    if (index < total - 1) {
      const delay = reduceMotion ? 120 : 400;
      advanceRef.current = setTimeout(() => setCurrent((c) => (c === index ? index + 1 : c)), delay);
    }
  }

  async function handleSubmit() {
    if (!sessionId || !userId || !exercise) return;
    stopActiveAudio();
    setPhase('submitting');

    const result = await submitKETTFDSAction({
      sessionId,
      userId,
      answers,
      exercise: { statements: exercise.statements, audio: exercise.audio },
    });

    if ('error' in result) {
      setErrorMsg(result.error);
      setPhase('ready');
      return;
    }

    setStatementResults(result.statement_results);
    setCorrectCount(result.correct_count);
    setAudio(result.audio);
    setPhase('finished');
    onSessionFinished?.();
  }

  const answeredCount = exercise ? Object.values(answers).filter((v) => v != null).length : 0;
  const allAnswered = exercise ? answeredCount === exercise.statements.length : false;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
        <p className="text-red-500 font-semibold">{errorMsg}</p>
        <button type="button" onClick={onBack} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm">
          Back
        </button>
      </div>
    );
  }

  const currentStatement = exercise?.statements[current];

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
          <KETListeningIcon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">True, False or Doesn&apos;t Say</p>
          <p className="text-xs text-gray-400">Listening · Part 5</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}>A2</span>
      </div>

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

      {phase === 'ready' && exercise && currentStatement && (
        <>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="mx-auto w-full max-w-lg flex flex-col gap-4">
              <AudioPill audiob64={audioB64} audiomime={audioMime} status={audioStatus} />

              <div className="flex items-start gap-3 rounded-3xl border border-gray-100 shadow-sm px-4 py-3" style={{ background: CARD_SURFACE }}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT_TINT, color: ACCENT }}>
                  <KETListeningIcon size={20} />
                </span>
                <p className="text-sm text-gray-700 leading-relaxed flex-1">{framingText}</p>
              </div>

              <ProgressDots
                statements={exercise.statements}
                answers={answers}
                current={current}
                onJump={(i) => { if (advanceRef.current) clearTimeout(advanceRef.current); setCurrent(i); }}
              />

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStatement.number}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="flex flex-col gap-3"
                >
                  <div className="rounded-3xl border border-gray-100 shadow-sm px-4 py-4 flex items-start gap-3" style={{ background: CARD_SURFACE }}>
                    <span className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5" style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}>
                      {currentStatement.number}
                    </span>
                    <p className="text-base font-semibold text-gray-800 leading-snug flex-1">{currentStatement.text}</p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {VERDICT_ORDER.map((v) => (
                      <VerdictCard
                        key={v}
                        verdict={v}
                        selected={answers[currentStatement.number] === v}
                        onSelect={() => handlePick(currentStatement.number, v, current, exercise.statements.length)}
                        disabled={false}
                        reduceMotion={!!reduceMotion}
                      />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="h-4" />
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <div className="mx-auto w-full max-w-lg">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!allAnswered}
                className="w-full px-6 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 cursor-pointer active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
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
          <div className="mx-auto w-full max-w-lg flex flex-col gap-4">
            {statementResults.map((r, i) => (
              <motion.div
                key={r.number}
                initial={isNewSession && !reduceMotion ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 24, delay: isNewSession ? i * 0.07 : 0 }}
                className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
                style={{ background: CARD_SURFACE }}
              >
                <div className="px-4 pt-4 pb-2 flex items-start gap-2">
                  <span className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5" style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}>{r.number}</span>
                  <p className="text-sm font-semibold text-gray-800 leading-snug flex-1">{r.text}</p>
                  <span
                    className={[
                      'ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                      r.is_correct ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50',
                    ].join(' ')}
                  >
                    {r.is_correct ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
                <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
                  {r.is_correct ? (
                    <VerdictBadge verdict={r.correct_verdict} />
                  ) : (
                    <>
                      {r.chosen
                        ? <VerdictBadge verdict={r.chosen} struck />
                        : <span className="px-3 py-1 rounded-full text-xs font-bold border border-gray-200 bg-gray-50 text-gray-400 italic">No answer</span>}
                      <span className="text-gray-300 text-sm" aria-hidden>→</span>
                      <VerdictBadge verdict={r.correct_verdict} />
                      <p className="w-full text-xs text-gray-500 leading-snug mt-1">{VERDICT_META[r.correct_verdict].secondary}.</p>
                    </>
                  )}
                </div>
              </motion.div>
            ))}

            <div className="flex justify-center pt-2">
              <CelebrationCard
                score={correctCount}
                scoreMax={exercise.statements.length}
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
