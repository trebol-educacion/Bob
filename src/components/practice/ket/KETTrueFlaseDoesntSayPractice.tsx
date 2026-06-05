'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { KETListeningIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import { pcmToWavBase64 } from '@/lib/audio';
import {
  generateKETTFDSAction,
  submitKETTFDSAction,
  type Verdict,
  type AudioTurn,
  type Statement,
  type StatementResult,
  type TFDSExercise,
} from '@/actions/modes/ket-listening-part5';
import type { StoredMessage } from '@/actions/messages';

export interface KETTrueFalseDoesntSayPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';

const VERDICTS: { value: Verdict; label: string; short: string }[] = [
  { value: 'T',  label: 'True',         short: 'T'  },
  { value: 'F',  label: 'False',        short: 'F'  },
  { value: 'DS', label: "Doesn't Say",  short: 'DS' },
];

const VERDICT_COLORS: Record<Verdict, { bg: string; text: string; border: string }> = {
  T:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-300' },
  F:  { bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-300'   },
  DS: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-300' },
};

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

function AudioPlayer({ audiob64, audiomime }: { audiob64: string; audiomime: string }) {
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopLocal = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setPlaying(false);
  };

  useEffect(() => () => stopLocal(), []);

  const handlePlay = async () => {
    if (playing) { stopLocal(); setProgress(0); return; }
    stopActiveAudio();
    const url = pcmToWavBase64(audiob64, audiomime);
    const audio = new Audio(url);
    audioRef.current = audio;
    _activeAudio = audio;
    audio.onended = () => { stopLocal(); setHasPlayed(true); setProgress(1); setTimeout(() => setProgress(0), 600); };
    audio.onerror = () => stopLocal();
    setPlaying(true);
    intervalRef.current = setInterval(() => {
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
    }, 100);
    try { await audio.play(); } catch { stopLocal(); }
  };

  const label = playing ? 'Playing…' : hasPlayed ? 'Listen again' : 'Listen';

  if (!audiob64) {
    return (
      <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-400">
        Audio not available — session restored without audio.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-white ring-1 ring-gray-100 rounded-2xl px-4 py-3 w-full">
      <button
        type="button"
        onClick={handlePlay}
        aria-label={label}
        className={[
          'w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white transition-all',
          playing ? 'animate-pulse' : '',
        ].join(' ')}
        style={{ background: 'var(--color-bob-brand)' }}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : hasPlayed ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 10 9 10" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${Math.round(progress * 100)}%`, background: 'var(--color-bob-brand)' }} />
        </div>
        <p className="text-[11px] text-gray-400 mt-1">{label}</p>
      </div>
    </div>
  );
}

function StatementCard({
  statement,
  selected,
  onSelect,
  disabled,
}: {
  statement: Statement;
  selected: Verdict | null;
  onSelect: (v: Verdict) => void;
  disabled: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: statement.number * 0.06 }}
      className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-4 pt-3 pb-3 flex items-start gap-2">
        <span
          className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5"
          style={{
            background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)',
            color: 'var(--color-bob-brand)',
          }}
        >
          {statement.number}
        </span>
        <p className="text-sm text-gray-800 leading-snug flex-1">{statement.text}</p>
      </div>
      <div className="px-4 pb-4 flex gap-2">
        {VERDICTS.map((v) => (
          <button
            key={v.value}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(v.value)}
            className={[
              'flex-1 py-2 rounded-xl border text-sm font-bold transition-all cursor-pointer',
              selected === v.value ? '' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-gray-100',
              disabled ? 'cursor-not-allowed' : '',
            ].filter(Boolean).join(' ')}
            style={
              selected === v.value
                ? { background: 'var(--color-bob-brand)', borderColor: 'var(--color-bob-brand)', color: 'white' }
                : undefined
            }
          >
            {v.short}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function StatementResultCard({
  result,
  animate,
}: {
  result: StatementResult;
  animate: boolean;
}) {
  const correctColors = VERDICT_COLORS[result.correct_verdict];
  const chosenColors = result.chosen ? VERDICT_COLORS[result.chosen] : null;
  const correctLabel = VERDICTS.find((v) => v.value === result.correct_verdict)?.label ?? result.correct_verdict;
  const chosenLabel = result.chosen ? (VERDICTS.find((v) => v.value === result.chosen)?.label ?? result.chosen) : null;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: result.number * 0.06 }}
      className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-4 pt-3 pb-2 flex items-start gap-2">
        <span
          className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5"
          style={{
            background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)',
            color: 'var(--color-bob-brand)',
          }}
        >
          {result.number}
        </span>
        <p className="text-sm text-gray-800 leading-snug flex-1">{result.text}</p>
        {result.is_correct ? (
          <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
        ) : (
          <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
        )}
      </div>
      <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
        {result.is_correct ? (
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${correctColors.bg} ${correctColors.text} ${correctColors.border}`}>
            {correctLabel}
          </span>
        ) : (
          <>
            {chosenColors && chosenLabel && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold border border-red-200 bg-red-50 text-red-500 line-through`}>
                {chosenLabel}
              </span>
            )}
            {!chosenLabel && (
              <span className="px-3 py-1 rounded-full text-xs font-bold border border-gray-200 bg-gray-50 text-gray-400 italic">
                No answer
              </span>
            )}
            <span className="text-xs text-gray-400">→</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${correctColors.bg} ${correctColors.text} ${correctColors.border}`}>
              {correctLabel}
            </span>
          </>
        )}
      </div>
    </motion.div>
  );
}

function TranscriptBlock({ turns }: { turns: AudioTurn[] }) {
  const [open, setOpen] = useState(false);
  const isMonologue = turns.length === 1;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <span>Show transcript</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-gray-100 pt-3">
          {isMonologue ? (
            <p className="text-xs text-gray-600 leading-relaxed">{turns[0].line}</p>
          ) : (
            turns.map((t, i) => (
              <p key={i} className="text-xs text-gray-600 leading-snug">
                <span className="font-bold text-gray-700 mr-1">
                  {t.speaker === 'M' ? 'Man:' : 'Woman:'}
                </span>
                {t.line}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** KET Listening Part 5 — True, False or Doesn't Say practice component. */
export function KETTrueFalseDoesntSayPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETTrueFalseDoesntSayPracticeProps) {
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
  const initStartedRef = useRef(false);

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

  const answeredCount = Object.values(answers).filter((v) => v !== null).length;
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

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600" aria-label="Back">←</button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)' }}>
          <KETListeningIcon size={18} className="text-bob-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">True, False or Doesn't Say</p>
          <p className="text-xs text-gray-400">Listening · Part 5</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)', color: 'var(--color-bob-brand)' }}>A2</span>
      </div>

      {(phase === 'loading' || phase === 'generating') && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={phase === 'loading' ? 'Preparing exercise…' : 'Generating audio…'} />
        </div>
      )}

      {phase === 'submitting' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Checking your answers…" />
        </div>
      )}

      {phase === 'ready' && exercise && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="flex items-start gap-2">
              <BobAvatar />
              <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed max-w-sm">
                {framingText}
              </div>
            </div>

            <AudioPlayer audiob64={exercise.audio_b64} audiomime={exercise.audio_mime} />

            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
              <p className="text-xs text-amber-800 leading-snug">
                <span className="font-bold">DS = Doesn't Say</span> — the speaker doesn't mention this at all. It's not wrong, it's just not said.
              </p>
            </div>

            {exercise.statements.map((s) => (
              <StatementCard
                key={s.number}
                statement={s}
                selected={answers[s.number] ?? null}
                onSelect={(v) => setAnswers((prev) => ({ ...prev, [s.number]: v }))}
                disabled={false}
              />
            ))}

            <div className="h-20" />
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
            <p className="text-xs text-gray-400 flex-1">{answeredCount} of {exercise.statements.length} answered</p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              style={{ background: 'var(--color-bob-brand)' }}
            >
              Check answers
            </button>
          </div>
        </>
      )}

      {phase === 'finished' && exercise && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {statementResults.map((r) => (
            <StatementResultCard key={r.number} result={r} animate={isNewSession} />
          ))}

          {audio.length > 0 && <TranscriptBlock turns={audio} />}

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
      )}
    </div>
  );
}
