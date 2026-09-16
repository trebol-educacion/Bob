'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { XCircle } from 'lucide-react';
import { PETListeningIcon } from '@/components/icons/PETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import { pcmToWavBase64 } from '@/lib/audio';
import {
  generatePETListeningGapFillAction,
  generatePETListeningGapFillAudioAction,
  submitPETListeningGapFillAction,
  type PETGapFillExercise,
  type PETGapFillGapResult,
} from '@/actions/modes/pet-listening-part3';
import type { StoredMessage } from '@/actions/messages';

const ACCENT = '#10B981';
const ACCENT_DARK = '#0E9F6E';
const ACCENT_TEXT = '#047857';
const ACCENT_TINT = 'color-mix(in oklab, #10B981 12%, white)';
const CARD_SURFACE = '#FAFAF8';

export interface PETListeningGapFillPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';
type AudioStatus = 'loading' | 'ready' | 'error';

interface RestoredState {
  exercise: PETGapFillExercise;
  framingText: string;
  gapResults: PETGapFillGapResult[] | null;
  correctCount: number;
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let exercise: PETGapFillExercise | null = null;
  let framingText = '';
  let gapResults: PETGapFillGapResult[] | null = null;
  let correctCount = 0;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'pet_listening_gapfill_plan') {
      const raw = cj.exercise as {
        context: string;
        summary_title: string;
        summary: string;
        gaps: Array<{ number: number }>;
        word_bank: string[];
      };
      exercise = {
        context: raw.context,
        summary_title: raw.summary_title,
        summary: raw.summary,
        gaps: raw.gaps.map((g) => ({ number: g.number })),
        word_bank: raw.word_bank,
        audio_b64: '',
        audio_mime: 'audio/L16;codec=pcm;rate=24000',
      };
      framingText = String(cj.framing_text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      gapResults = cj.gap_results as PETGapFillGapResult[];
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
        <div className="rounded-full ring-1 ring-emerald-100 bg-emerald-50 px-3 py-2 flex items-center gap-3 h-12">
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

  const label = playing ? 'Playing…' : hasPlayed ? 'Listen again' : 'Listen to the talk';

  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm pb-2 pt-4">
      <div className="relative rounded-full ring-1 ring-emerald-100 bg-emerald-50 px-3 py-2 flex items-center gap-3 h-12 overflow-hidden">
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
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] bg-emerald-200/60">
          <div
            className="h-full transition-all"
            style={{ width: `${Math.round(progress * 100)}%`, background: ACCENT }}
          />
        </div>
      </div>
    </div>
  );
}

type SummaryToken = { kind: 'text'; value: string } | { kind: 'gap'; number: number };

function tokenizeSummary(summary: string): SummaryToken[] {
  const tokens: SummaryToken[] = [];
  const regex = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(summary)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: 'text', value: summary.slice(lastIndex, match.index) });
    }
    tokens.push({ kind: 'gap', number: Number(match[1]) });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < summary.length) {
    tokens.push({ kind: 'text', value: summary.slice(lastIndex) });
  }
  return tokens;
}

function GapSlot({
  number,
  value,
  active,
  onActivate,
  onChange,
}: {
  number: number;
  value: string;
  active: boolean;
  onActivate: () => void;
  onChange: (v: string) => void;
}) {
  const filled = value.trim() !== '';
  const borderColor = filled || active ? ACCENT : '#D1D5DB';

  return (
    <span className="inline-flex items-baseline align-baseline mx-0.5">
      <span
        className={`mr-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black shrink-0 ${
          filled ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-400'
        }`}
        aria-hidden
      >
        {number}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onActivate}
        placeholder="…"
        autoComplete="off"
        inputMode="text"
        aria-label={`Gap ${number}`}
        className="bg-transparent border-0 border-b-2 px-1 text-base text-gray-800 placeholder-gray-300 focus:outline-none transition-colors duration-150 font-kalam"
        style={{ borderColor, width: `${Math.max(3, value.length + 1)}ch`, minWidth: '3ch' }}
      />
    </span>
  );
}

function WordChip({
  word,
  used,
  onTap,
}: {
  word: string;
  used: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={used}
      className={[
        'px-3 py-1.5 rounded-full text-sm font-semibold border transition-all',
        used
          ? 'border-gray-100 bg-gray-50 text-gray-300 line-through cursor-default'
          : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 active:scale-95 cursor-pointer',
      ].join(' ')}
    >
      {word}
    </button>
  );
}

function GapResultSlot({ number, result }: { number: number; result: PETGapFillGapResult | undefined }) {
  if (!result) return <span className="mx-0.5 text-gray-300">[{number}]</span>;
  const correct = result.is_correct;
  const borderColor = correct ? '#4ade80' : '#fb7185';

  return (
    <span className="inline-flex flex-wrap items-baseline align-baseline gap-x-1 mx-0.5">
      <span
        className={`mr-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black shrink-0 ${
          correct ? 'bg-green-400 text-white' : 'bg-rose-400 text-white'
        }`}
        aria-hidden
      >
        {number}
      </span>
      <span className="border-b-2 px-1 font-kalam text-base" style={{ borderColor }}>
        {correct ? (
          <span className="text-green-700 font-semibold">{result.user_input || '—'}</span>
        ) : (
          <span className="text-rose-500 line-through">{result.user_input || '—'}</span>
        )}
      </span>
      {!correct && (
        <span className="inline-flex items-baseline gap-1">
          <XCircle size={14} className="text-rose-400 self-center shrink-0" />
          <span className="bg-green-50 text-green-700 rounded-full px-2 py-0.5 text-sm font-semibold">
            {result.correct_answer}
          </span>
        </span>
      )}
    </span>
  );
}

/** PET Listening Part 3 — Interactive Gap-Fill practice component. */
export function PETListeningGapFillPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: PETListeningGapFillPracticeProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [exercise, setExercise] = useState<PETGapFillExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [activeGap, setActiveGap] = useState<number | null>(null);
  const [gapResults, setGapResults] = useState<PETGapFillGapResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('loading');
  const [audioB64, setAudioB64] = useState('');
  const [audioMime, setAudioMime] = useState('audio/L16;codec=pcm;rate=24000');
  const initStartedRef = useRef(false);
  const audioStartedRef = useRef(false);

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

      const result = await generatePETListeningGapFillAction({ sessionId: initialSessionId });

      if ('error' in result) {
        setErrorMsg(result.error);
        return;
      }

      onSessionCreated?.(result.sessionId);
      setSessionId(result.sessionId);
      setUserId(result.userId);
      setExercise(result.exercise);
      setFramingText(result.framingText);
      setPhase('ready');
    }

    void init();
  }, []);

  useEffect(() => {
    if (audioStartedRef.current) return;
    if (phase === 'finished') return;
    if (!exercise || !sessionId || !userId) return;
    audioStartedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const audio = await generatePETListeningGapFillAudioAction({ sessionId, userId });
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
  }, [exercise, sessionId, userId, phase]);

  const summaryTokens = useMemo(
    () => (exercise ? tokenizeSummary(exercise.summary) : []),
    [exercise]
  );

  const usedWords = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of Object.values(answers)) {
      const key = v.trim().toLowerCase();
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [answers]);

  function setGap(number: number, value: string) {
    setAnswers((prev) => ({ ...prev, [number]: value }));
  }

  function handleWordTap(word: string) {
    const target = activeGap ?? exercise?.gaps.find((g) => !(answers[g.number]?.trim()))?.number;
    if (target == null) return;
    setGap(target, word);
    const next = exercise?.gaps.find((g) => g.number > target && !(answers[g.number]?.trim()));
    setActiveGap(next?.number ?? null);
  }

  async function handleSubmit() {
    if (!sessionId || !userId) return;
    stopActiveAudio();
    setPhase('submitting');

    const result = await submitPETListeningGapFillAction({ sessionId, userId, answers });

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

  const totalGaps = exercise?.gaps.length ?? 0;
  const answeredCount = exercise
    ? exercise.gaps.filter((g) => (answers[g.number] ?? '').trim() !== '').length
    : 0;
  const allAnswered = totalGaps > 0 && answeredCount === totalGaps;
  const progressPct = totalGaps > 0 ? (answeredCount / totalGaps) * 100 : 0;

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
          <PETListeningIcon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">Interactive Gap-Fill</p>
          <p className="text-xs text-gray-400">Listening · Part 3</p>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          B1
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
                className="rounded-3xl px-4 py-4 border border-gray-100 shadow-sm"
                style={{ background: CARD_SURFACE }}
              >
                <p className="text-sm font-bold text-gray-800 mb-0.5">{exercise.summary_title}</p>
                <p className="text-xs text-gray-400 leading-tight mb-3">{exercise.context}</p>
                <p className="text-gray-700 leading-loose text-base">
                  {summaryTokens.map((tok, i) =>
                    tok.kind === 'text' ? (
                      <span key={i}>{tok.value}</span>
                    ) : (
                      <GapSlot
                        key={i}
                        number={tok.number}
                        value={answers[tok.number] ?? ''}
                        active={activeGap === tok.number}
                        onActivate={() => setActiveGap(tok.number)}
                        onChange={(v) => setGap(tok.number, v)}
                      />
                    )
                  )}
                </p>
              </motion.div>

              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Word bank</p>
                <div className="flex flex-wrap gap-2">
                  {exercise.word_bank.map((word, i) => (
                    <WordChip
                      key={`${word}-${i}`}
                      word={word}
                      used={(usedWords[word.trim().toLowerCase()] ?? 0) > 0}
                      onTap={() => handleWordTap(word)}
                    />
                  ))}
                </div>
              </div>

              <div className="h-20" />
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <div className="mx-auto w-full max-w-lg flex items-center gap-3">
              <p className="text-xs font-semibold text-gray-500 flex-1">
                {answeredCount} of {totalGaps} answered
              </p>
              <button
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
              <p className="text-sm font-bold text-gray-800 mb-0.5">{exercise.summary_title}</p>
              <p className="text-xs text-gray-400 leading-tight mb-3">{exercise.context}</p>
              <p className="text-gray-700 leading-loose text-base">
                {summaryTokens.map((tok, i) =>
                  tok.kind === 'text' ? (
                    <span key={i}>{tok.value}</span>
                  ) : (
                    <GapResultSlot
                      key={i}
                      number={tok.number}
                      result={gapResults.find((r) => r.number === tok.number)}
                    />
                  )
                )}
              </p>
            </motion.div>

            <div className="flex justify-center pt-2">
              <CelebrationCard
                score={correctCount}
                scoreMax={totalGaps}
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
