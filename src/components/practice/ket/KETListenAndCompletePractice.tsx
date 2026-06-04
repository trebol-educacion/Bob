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
  generateKETListenCompleteAction,
  submitKETListenCompleteAction,
  type ListenCompleteExercise,
  type GapResult,
} from '@/actions/modes/ket-listening-part2';
import type { StoredMessage } from '@/actions/messages';

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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 10 9 10" />
    </svg>
  );
}

function AudioPlayer({ audiob64, audiomime }: { audiob64: string; audiomime: string }) {
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
        {playing ? <PauseIcon /> : hasPlayed ? <ReplayIcon /> : <PlayIcon />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ width: `${Math.round(progress * 100)}%`, background: 'var(--color-bob-brand)' }}
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-1">{label}</p>
      </div>
    </div>
  );
}

function GapInput({
  gap,
  value,
  onChange,
  disabled,
}: {
  gap: { number: number; label: string };
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <span
        className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0"
        style={{
          background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)',
          color: 'var(--color-bob-brand)',
        }}
      >
        {gap.number}
      </span>
      <span className="text-sm text-gray-600 w-28 shrink-0">{gap.label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="…"
        className="flex-1 min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ '--tw-ring-color': 'var(--color-bob-brand)' } as React.CSSProperties}
      />
    </div>
  );
}

function GapResultRow({ result }: { result: GapResult }) {
  return (
    <div
      className={[
        'flex items-center gap-3 py-2 border-b border-gray-100 last:border-0',
      ].join(' ')}
    >
      <span
        className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0"
        style={{
          background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)',
          color: 'var(--color-bob-brand)',
        }}
      >
        {result.number}
      </span>
      <span className="text-sm text-gray-500 w-28 shrink-0">{result.label}</span>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p
          className={[
            'text-sm font-medium',
            result.is_correct ? 'text-green-700' : 'text-red-600 line-through',
          ].join(' ')}
        >
          {result.user_input || '—'}
        </p>
        {!result.is_correct && (
          <p className="text-xs text-gray-500">
            Correct: <span className="font-semibold text-gray-700">{result.correct_answer}</span>
          </p>
        )}
      </div>
      {result.is_correct ? (
        <CheckCircle size={16} className="text-green-500 shrink-0" />
      ) : (
        <XCircle size={16} className="text-red-400 shrink-0" />
      )}
    </div>
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
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          aria-label="Back"
        >
          ←
        </button>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)' }}
        >
          <KETListeningIcon size={18} className="text-bob-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">Listen and Complete</p>
          <p className="text-xs text-gray-400">KET Listening · Part 2</p>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
          style={{
            background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)',
            color: 'var(--color-bob-brand)',
          }}
        >
          A2
        </span>
      </div>

      {(phase === 'loading' || phase === 'generating') && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader
            message={
              phase === 'loading' ? 'Preparing exercise…' : 'Generating audio…'
            }
          />
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

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              <AudioPlayer audiob64={exercise.audio_b64} audiomime={exercise.audio_mime} />

              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div
                  className="px-4 py-3 border-b border-gray-100"
                  style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)' }}
                >
                  <p className="text-xs text-gray-400 mb-0.5">{exercise.context}</p>
                  <p className="text-sm font-bold text-gray-800">{exercise.form_title}</p>
                </div>
                <div className="px-4 py-2">
                  {exercise.gaps.map((gap) => (
                    <GapInput
                      key={gap.number}
                      gap={gap}
                      value={answers[gap.number] ?? ''}
                      onChange={(v) =>
                        setAnswers((prev) => ({ ...prev, [gap.number]: v }))
                      }
                      disabled={false}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

            <div className="h-20" />
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
            <p className="text-xs text-gray-400 flex-1">
              {answeredCount} of {exercise.gaps.length} answered
            </p>
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
          <motion.div
            initial={isNewSession ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
          >
            <div
              className="px-4 py-3 border-b border-gray-100"
              style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)' }}
            >
              <p className="text-xs text-gray-400 mb-0.5">{exercise.context}</p>
              <p className="text-sm font-bold text-gray-800">{exercise.form_title}</p>
            </div>
            <div className="px-4 py-2">
              {gapResults.map((r) => (
                <GapResultRow key={r.number} result={r} />
              ))}
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
      )}
    </div>
  );
}
