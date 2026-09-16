'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { PETListeningIcon } from '@/components/icons/PETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { pcmToWavBase64 } from '@/lib/audio';
import {
  generatePETListeningTrueFalseJustifyAction,
  generatePETListeningTrueFalseJustifyAudioAction,
  submitPETListeningTrueFalseJustifyAction,
  type PETJustifyAudioTurn,
  type PETJustifyClientStatement,
  type PETJustifyStatementResult,
  type WhyKey,
} from '@/actions/modes/pet-listening-part5';
import type { StoredMessage } from '@/actions/messages';
import type { YLRenderProps } from '@/lib/routing';

const ACCENT = '#10B981';
const ACCENT_DARK = '#0E9F6E';
const ACCENT_TEXT = '#047857';
const ACCENT_TINT = 'color-mix(in oklab, #10B981 12%, white)';
const CARD_SURFACE = '#FAFAF8';
const AUDIO_MIME = 'audio/L16;codec=pcm;rate=24000';

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';
type AudioStatus = 'loading' | 'ready' | 'error';
type Verdict = 'T' | 'F';

interface ClientAnswer {
  verdict: Verdict | null;
  why?: WhyKey | null;
}

interface RestoredState {
  statements: PETJustifyClientStatement[];
  audio: PETJustifyAudioTurn[];
  framingText: string;
  statementResults: PETJustifyStatementResult[] | null;
  score: number;
  scoreMax: number;
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let statements: PETJustifyClientStatement[] | null = null;
  let audio: PETJustifyAudioTurn[] = [];
  let framingText = '';
  let statementResults: PETJustifyStatementResult[] | null = null;
  let score = 0;
  let scoreMax = 0;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'pet_listening_tf_justify_plan') {
      const rawStatements = (cj.statements as Array<{ number: number; text: string; why_options?: { A: string; B: string; C?: string } }>) ?? [];
      statements = rawStatements.map((s) => ({
        number: s.number,
        text: s.text,
        ...(s.why_options ? { why_options: s.why_options } : {}),
      }));
      audio = (cj.audio as PETJustifyAudioTurn[]) ?? [];
      framingText = String(cj.framing_text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      statementResults = cj.statement_results as PETJustifyStatementResult[];
      score = Number(cj.score ?? 0);
      scoreMax = Number(cj.score_max ?? 0);
      if ((cj.audio as PETJustifyAudioTurn[] | undefined)?.length) {
        audio = cj.audio as PETJustifyAudioTurn[];
      }
    }
  }

  if (statements) return { statements, audio, framingText, statementResults, score, scoreMax };
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
      <div className="rounded-full ring-1 ring-gray-100 bg-gray-50 px-3 py-2 flex items-center gap-3 h-12">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-200 text-gray-400">
          <PlayIcon />
        </div>
        <p className="flex-1 text-sm font-semibold text-gray-400">Audio unavailable</p>
      </div>
    );
  }

  if (status === 'loading') {
    return (
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
    );
  }

  const label = playing ? 'Playing…' : hasPlayed ? 'Listen again' : 'Listen to the interview';

  return (
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
  );
}

function VerdictButton({
  label,
  selected,
  onSelect,
  disabled,
  reduceMotion,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
  reduceMotion: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.98 }}
      className={[
        'relative rounded-2xl border px-4 py-3 text-sm font-bold text-gray-800 cursor-pointer min-h-12 flex items-center justify-center',
        disabled ? 'cursor-not-allowed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        selected
          ? { background: '#ECFDF5', borderColor: ACCENT, boxShadow: 'none', transform: 'translateY(2px)', color: ACCENT_TEXT }
          : { background: CARD_SURFACE, borderColor: '#F3F4F6', boxShadow: '0 3px 0 #e5e7eb' }
      }
    >
      {label}
    </motion.button>
  );
}

function WhyOptionButton({
  optionId,
  text,
  selected,
  onSelect,
  disabled,
  reduceMotion,
}: {
  optionId: WhyKey;
  text: string;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
  reduceMotion: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.98 }}
      className={[
        'relative rounded-2xl border p-3 pr-9 text-left text-sm font-semibold text-gray-800 cursor-pointer min-h-11',
        disabled ? 'cursor-not-allowed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        selected
          ? { background: '#ECFDF5', borderColor: ACCENT, boxShadow: 'none', transform: 'translateY(2px)' }
          : { background: '#FFFFFF', borderColor: '#F3F4F6', boxShadow: '0 3px 0 #e5e7eb' }
      }
    >
      <span className="block leading-snug">{text}</span>
      {selected && (
        <motion.span
          initial={reduceMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="absolute top-1/2 -translate-y-1/2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: ACCENT }}
        >
          <Check size={12} strokeWidth={3.5} className="text-white" />
        </motion.span>
      )}
      <span
        className={[
          'absolute bottom-1.5 right-2 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center',
          selected ? 'opacity-0' : '',
        ].join(' ')}
        style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        aria-hidden
      >
        {optionId}
      </span>
    </motion.button>
  );
}

function whyKeys(opts?: { A: string; B: string; C?: string }): WhyKey[] {
  if (!opts) return [];
  const keys: WhyKey[] = ['A', 'B'];
  if (opts.C !== undefined) keys.push('C');
  return keys;
}

function StatementCard({
  statement,
  answer,
  onVerdict,
  onWhy,
  disabled,
  index,
  animate,
  reduceMotion,
}: {
  statement: PETJustifyClientStatement;
  answer: ClientAnswer | undefined;
  onVerdict: (v: Verdict) => void;
  onWhy: (w: WhyKey) => void;
  disabled: boolean;
  index: number;
  animate: boolean;
  reduceMotion: boolean;
}) {
  const showWhy = answer?.verdict === 'F' && statement.why_options !== undefined;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24, delay: animate ? index * 0.07 : 0 }}
      className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
      style={{ background: CARD_SURFACE }}
    >
      <div className="px-4 pt-4 pb-2 flex items-start gap-2">
        <span
          className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          {statement.number}
        </span>
        <p className="text-sm font-semibold text-gray-800 leading-snug flex-1">{statement.text}</p>
      </div>
      <div className="px-4 pb-3 grid grid-cols-2 gap-2">
        <VerdictButton label="True" selected={answer?.verdict === 'T'} onSelect={() => onVerdict('T')} disabled={disabled} reduceMotion={reduceMotion} />
        <VerdictButton label="False" selected={answer?.verdict === 'F'} onSelect={() => onVerdict('F')} disabled={disabled} reduceMotion={reduceMotion} />
      </div>
      {showWhy && statement.why_options && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="px-4 pb-4"
        >
          <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Why is it false?</p>
          <div className="space-y-2">
            {whyKeys(statement.why_options).map((k) => (
              <WhyOptionButton
                key={k}
                optionId={k}
                text={statement.why_options![k]!}
                selected={answer?.why === k}
                onSelect={() => onWhy(k)}
                disabled={disabled}
                reduceMotion={reduceMotion}
              />
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function ResultStatementCard({
  result,
  index,
  animate,
  reduceMotion,
}: {
  result: PETJustifyStatementResult;
  index: number;
  animate: boolean;
  reduceMotion: boolean;
}) {
  const fullyCorrect = result.points === result.points_max;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24, delay: animate ? index * 0.07 : 0 }}
      className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
      style={{ background: CARD_SURFACE }}
    >
      <div className="px-4 pt-4 pb-2 flex items-start gap-2">
        <span
          className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          {result.number}
        </span>
        <p className="text-sm font-semibold text-gray-800 leading-snug flex-1">{result.text}</p>
        <span
          className={[
            'ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
            fullyCorrect ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50',
          ].join(' ')}
        >
          {fullyCorrect ? 'Correct' : 'Incorrect'}
        </span>
      </div>
      <div className="px-4 pb-3 space-y-2">
        <div
          className={[
            'rounded-2xl border p-3 text-sm font-semibold flex items-center justify-between',
            result.verdict_correct ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-700',
          ].join(' ')}
        >
          <span>
            You said {result.chosen_verdict === 'T' ? 'True' : result.chosen_verdict === 'F' ? 'False' : '—'}
          </span>
          <span className="text-xs font-bold">
            Answer: {result.correct_verdict === 'T' ? 'True' : 'False'}
          </span>
        </div>
        {result.correct_verdict === 'F' && result.why_options && (
          <div className="space-y-1.5">
            {whyKeys(result.why_options).map((k) => {
              const isCorrectOption = k === result.correct_why;
              const isChosen = k === result.chosen_why;
              const showGreen = isCorrectOption;
              const showRed = isChosen && !isCorrectOption;
              return (
                <div
                  key={k}
                  className={[
                    'relative rounded-2xl border p-3 pr-9 text-sm font-semibold',
                    showGreen ? 'border-green-400 bg-green-50 text-green-800' : '',
                    showRed ? 'border-red-400 bg-red-50 text-red-700' : '',
                    !showGreen && !showRed ? 'border-gray-100 text-gray-400 opacity-60 bg-white' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="block leading-snug">{result.why_options![k]!}</span>
                  <span
                    className={[
                      'absolute bottom-1.5 right-2 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center',
                      showGreen ? 'bg-green-500 text-white' : showRed ? 'bg-red-400 text-white' : 'bg-gray-200 text-gray-400',
                    ].join(' ')}
                    aria-hidden
                  >
                    {k}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** PET Listening Part 5 — True or False with Justification practice component. */
export function PETListeningTrueFalseJustifyPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: YLRenderProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [statements, setStatements] = useState<PETJustifyClientStatement[]>([]);
  const [audio, setAudio] = useState<PETJustifyAudioTurn[]>([]);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, ClientAnswer>>({});
  const [statementResults, setStatementResults] = useState<PETJustifyStatementResult[]>([]);
  const [score, setScore] = useState(0);
  const [scoreMax, setScoreMax] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [audioState, setAudioState] = useState<{ b64: string; mime: string; status: AudioStatus }>({ b64: '', mime: AUDIO_MIME, status: 'loading' });
  const initStartedRef = useRef(false);
  const audioStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    async function init() {
      if (initialMessages && initialMessages.length > 0) {
        const restored = tryRestore(initialMessages);
        if (restored) {
          setStatements(restored.statements);
          setAudio(restored.audio);
          setFramingText(restored.framingText);
          if (restored.statementResults) {
            setStatementResults(restored.statementResults);
            setScore(restored.score);
            setScoreMax(restored.scoreMax);
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

      const result = await generatePETListeningTrueFalseJustifyAction({ sessionId: initialSessionId });

      if ('error' in result) {
        setErrorMsg(result.error);
        return;
      }

      onSessionCreated?.(result.sessionId);
      setSessionId(result.sessionId);
      setUserId(result.userId);
      setStatements(result.statements);
      setAudio(result.audio);
      setFramingText(result.framingText);
      setPhase('ready');
    }

    void init();
  }, []);

  useEffect(() => {
    if (audioStartedRef.current) return;
    if (phase !== 'ready' && phase !== 'finished') return;
    if (!audio.length) return;
    audioStartedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const result = await generatePETListeningTrueFalseJustifyAudioAction({ audio });
        if (cancelled) return;
        setAudioState(
          result.data
            ? { b64: result.data, mime: result.mimeType, status: 'ready' }
            : { b64: '', mime: result.mimeType, status: 'error' }
        );
      } catch {
        if (cancelled) return;
        setAudioState({ b64: '', mime: AUDIO_MIME, status: 'error' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, audio]);

  function setVerdict(number: number, verdict: Verdict) {
    setAnswers((prev) => {
      const current = prev[number];
      if (verdict === 'T') return { ...prev, [number]: { verdict: 'T' } };
      return { ...prev, [number]: { verdict: 'F', why: current?.why ?? null } };
    });
  }

  function setWhy(number: number, why: WhyKey) {
    setAnswers((prev) => ({ ...prev, [number]: { verdict: 'F', why } }));
  }

  function isAnswered(s: PETJustifyClientStatement): boolean {
    const a = answers[s.number];
    if (!a || a.verdict === null) return false;
    if (a.verdict === 'F' && s.why_options !== undefined) return a.why != null;
    return true;
  }

  async function handleSubmit() {
    if (!sessionId || !userId) return;
    stopActiveAudio();
    setPhase('submitting');

    const result = await submitPETListeningTrueFalseJustifyAction({ sessionId, userId, answers });

    if ('error' in result) {
      setErrorMsg(result.error);
      setPhase('ready');
      return;
    }

    setStatementResults(result.statement_results);
    setScore(result.score);
    setScoreMax(result.score_max);
    setPhase('finished');
    onSessionFinished?.();
  }

  const answeredCount = statements.filter(isAnswered).length;
  const allAnswered = statements.length > 0 && answeredCount === statements.length;
  const progressPct = statements.length > 0 ? (answeredCount / statements.length) * 100 : 0;

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
          <p className="text-sm font-bold text-gray-800 truncate">True or False with Justification</p>
          <p className="text-xs text-gray-400">Listening · Part 5</p>
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

      {phase === 'ready' && statements.length > 0 && (
        <>
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
            <div className="mx-auto w-full max-w-lg space-y-4">
              <div className="flex items-start gap-3 rounded-3xl border border-gray-100 shadow-sm px-4 py-3" style={{ background: CARD_SURFACE }}>
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: ACCENT_TINT, color: ACCENT }}
                >
                  <PETListeningIcon size={20} />
                </span>
                <p className="text-sm text-gray-700 leading-relaxed flex-1">{framingText}</p>
              </div>

              <div className="rounded-3xl border border-gray-100 shadow-sm px-4 py-4" style={{ background: CARD_SURFACE }}>
                <AudioPlayer audiob64={audioState.b64} audiomime={audioState.mime} status={audioState.status} />
              </div>

              {statements.map((s, i) => (
                <StatementCard
                  key={s.number}
                  statement={s}
                  answer={answers[s.number]}
                  onVerdict={(v) => setVerdict(s.number, v)}
                  onWhy={(w) => setWhy(s.number, w)}
                  disabled={false}
                  index={i}
                  animate={isNewSession}
                  reduceMotion={!!reduceMotion}
                />
              ))}

              <div className="h-20" />
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <div className="mx-auto w-full max-w-lg flex items-center gap-3">
              <p className="text-xs font-semibold text-gray-500 flex-1">
                {answeredCount} of {statements.length} answered
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

      {phase === 'finished' && statements.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto w-full max-w-lg space-y-4">
            {statementResults.map((result, i) => (
              <ResultStatementCard
                key={result.number}
                result={result}
                index={i}
                animate={isNewSession}
                reduceMotion={!!reduceMotion}
              />
            ))}

            <div className="flex justify-center pt-2">
              <CelebrationCard
                score={score}
                scoreMax={scoreMax}
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
