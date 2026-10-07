'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { XCircle } from 'lucide-react';
import { PETListeningIcon } from '@/components/icons/PETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import { PETAudioPlayer } from './PETAudioPlayer';
import { stopActiveClip } from '@/lib/audio-clip';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
import {
  generatePETListeningGapFillAction,
  submitPETListeningGapFillAction,
  type PETGapFillExercise,
  type PETGapFillGapResult,
} from '@/actions/modes/pet-listening-part3';
import type { StoredMessage } from '@/actions/messages';
import { resolveActivityBoot } from '@/lib/activity/boot';
import { ActivityHeader } from '@/components/activity/ActivityHeader';

const ACCENT = '#10B981';
const ACCENT_DARK = '#0E9F6E';
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

interface RestoredState {
  exercise: PETGapFillExercise;
  framingText: string;
  gapResults: PETGapFillGapResult[] | null;
  correctCount: number;
}

export function tryRestore(messages: StoredMessage[]): RestoredState | null {
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
        audio_url?: string;
      };
      exercise = {
        context: raw.context,
        summary_title: raw.summary_title,
        summary: raw.summary,
        gaps: raw.gaps.map((g) => ({ number: g.number })),
        word_bank: raw.word_bank,
        audio_url: raw.audio_url ?? '',
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
          <span className="text-green-700 font-semibold">{result.user_input || '-'}</span>
        ) : (
          <span className="text-rose-500 line-through">{result.user_input || '-'}</span>
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

/** PET Listening Part 3, Interactive Gap-Fill practice component. */
export function PETListeningGapFillPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: PETListeningGapFillPracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [planToken, setPlanToken] = useState<string | null>(null);
  const [exercise, setExercise] = useState<PETGapFillExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [activeGap, setActiveGap] = useState<number | null>(null);
  const [gapResults, setGapResults] = useState<PETGapFillGapResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const initStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    async function init() {
      const boot = resolveActivityBoot({ initialMessages, sessionId: initialSessionId, tryRestore });
      if (boot.kind === 'restore') {
        const restored = boot.data;
        setExercise(restored.exercise);
        setFramingText(restored.framingText);
        if (restored.gapResults) {
          setGapResults(restored.gapResults);
          setCorrectCount(restored.correctCount);
          setPhase('finished');
        } else {
          setErrorMsg('Could not restore session. Please start a new one.');
        }
        return;
      }

      if (boot.kind === 'restore-failed') { setErrorMsg('Could not restore session. Please start a new one.'); return; }

      setIsNewSession(true);
      setPhase('generating');

      const generated = await generatePETListeningGapFillAction();

      if (!generated.ok) {
        setLoadErrorCode(generated.code);
        return;
      }
      const result = generated.data;

      setPlanToken(result.planToken);
      setExercise(result.exercise);
      setFramingText(result.framingText);
      setPhase('ready');
    }

    void init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!planToken) return;
    stopActiveClip();
    setPhase('submitting');

    const result = await submitPETListeningGapFillAction({ sessionId, planToken, answers });

    if ('error' in result) {
      setErrorMsg(result.error);
      setPhase('ready');
      return;
    }

    if (!sessionId) onSessionCreated?.(result.sessionId);
    setSessionId(result.sessionId);
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

  if (loadErrorCode) return <ActivityLoadError code={loadErrorCode} onBack={onBack} />;

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
      <ActivityHeader
        title="Gap-Fill"
        subtitle="Listening · Part 3"
        badge="Part 3"
        icon={<PETListeningIcon size={18} />}
        iconStyle={{ background: ACCENT_TINT, color: ACCENT }}
        onBack={onBack}
      />

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
              <PETAudioPlayer url={exercise.audio_url} idleLabel="Listen to the talk" />

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
                Submit answers
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
