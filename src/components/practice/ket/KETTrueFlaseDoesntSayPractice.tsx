'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { KETListeningIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
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
import { restoreExercise } from '@/lib/ket/restore-plan';
import { EMPTY_AUDIO } from '@/lib/ket/plan';
import { useAudioClip } from '@/hooks/useAudioClip';
import { stopActiveClip } from '@/lib/audio-clip';
import { PauseIcon, PlayIcon, ReplayIcon } from '@/components/activity/audio-icons';
import { resolveActivityBoot } from '@/lib/activity/boot';

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
type AudioStatus = 'ready' | 'error';

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
  const r = restoreExercise<TFDSExercise, StatementResult>(messages, 'tfds_plan', 'statement_results', { mapExercise: (raw) => ({ ...raw, ...EMPTY_AUDIO }) });
  return r ? { exercise: r.exercise, framingText: r.framingText, statementResults: r.results, correctCount: r.correctCount, audio: r.exercise.audio ?? [] } : null;
}

function AudioPill({
  audioUrl,
  status,
}: {
  audioUrl: string;
  status: AudioStatus;
}) {
  const reduceMotion = useReducedMotion();
  const clip = useAudioClip({ src: audioUrl });
  const playing = clip.isPlaying;
  const progress = clip.progress;
  const hasPlayed = clip.hasPlayed;
  const failed = clip.failed;

  if (status === 'error' || failed) {
    return (
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm pb-2 pt-4">
        <div className="rounded-full ring-1 ring-gray-100 bg-gray-50 px-3 py-2 flex items-center gap-3 h-12">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-200 text-gray-400">
            <PlayIcon className="w-5 h-5" />
          </div>
          {failed ? (
            <button type="button" onClick={clip.retry} className="flex-1 text-left text-sm font-semibold text-gray-600">Try again</button>
          ) : (
            <p className="flex-1 text-sm font-semibold text-gray-400">Audio unavailable</p>
          )}
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
            onClick={clip.toggle}
            aria-label={label}
            className="relative w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 text-white"
            style={{ background: ACCENT }}
          >
            {playing ? <PauseIcon className="w-5 h-5" /> : hasPlayed ? <ReplayIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
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

/** KET Listening Part 5, True, False or Doesn't Say focus-mode practice component. */
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
  const [exercise, setExercise] = useState<TFDSExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, Verdict | null>>({});
  const [statementResults, setStatementResults] = useState<StatementResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [loadError, setLoadError] = useState<{ code?: string; message?: string } | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [current, setCurrent] = useState(0);
  const initStartedRef = useRef(false);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    async function init() {
      const boot = resolveActivityBoot({ initialMessages, sessionId: initialSessionId, tryRestore });
      if (boot.kind === 'restore') {
        const restored = boot.data;
        setExercise(restored.exercise);
        setFramingText(restored.framingText);
        if (restored.statementResults) {
          setStatementResults(restored.statementResults);
          setCorrectCount(restored.correctCount);
          setPhase('finished');
        } else {
          setPhase('ready');
        }
        return;
      }

      if (boot.kind === 'restore-failed') { setLoadError({ message: 'Could not restore session. Please start a new one.' }); return; }

      setIsNewSession(true);
      setPhase('generating');

      const result = await generateKETTFDSAction();

      if (!result.ok) {
        setLoadError({ code: result.code });
        return;
      }
      setExercise(result.data.exercise);
      setFramingText(result.data.framing_text);
      setPhase('ready');
    }

    void init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!exercise) return;
    stopActiveClip();
    setPhase('submitting');

    const result = await submitKETTFDSAction({
      sessionId,
      framing_text: framingText,
      answers,
      exercise,
    });

    if ('error' in result) {
      setLoadError({ message: result.error });
      setPhase('ready');
      return;
    }

    setStatementResults(result.statement_results);
    setCorrectCount(result.correct_count);
    setPhase('finished');
    if (!sessionId) onSessionCreated?.(result.sessionId);
    setSessionId(result.sessionId);
    onSessionFinished?.();
  }

  const answeredCount = exercise ? Object.values(answers).filter((v) => v != null).length : 0;
  const allAnswered = exercise ? answeredCount === exercise.statements.length : false;

  if (loadError) return <ActivityLoadError {...loadError} onBack={onBack} />;

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
              <AudioPill audioUrl={exercise?.audio_url ?? ''} status={exercise?.audio_url ? 'ready' : 'error'} />

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
