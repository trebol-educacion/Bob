'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { PETListeningIcon } from '@/components/icons/PETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { PETAudioPlayer, stopActivePETAudio } from './PETAudioPlayer';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
import {
  generatePETListeningAttitudeAction,
  submitPETListeningAttitudeAction,
  type PETAttitudeClientItem,
  type PETAttitudeItemResult,
} from '@/actions/modes/pet-listening-part4';
import type { StoredMessage } from '@/actions/messages';
import { resolveActivityBoot } from '@/lib/activity/boot';

const ACCENT = '#10B981';
const ACCENT_DARK = '#0E9F6E';
const ACCENT_TEXT = '#047857';
const ACCENT_TINT = 'color-mix(in oklab, #10B981 12%, white)';
const CARD_SURFACE = '#FAFAF8';

export interface PETListeningAttitudePracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';

interface RestoredState {
  items: PETAttitudeClientItem[];
  framingText: string;
  itemResults: PETAttitudeItemResult[] | null;
  correctCount: number;
}

export function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let items: PETAttitudeClientItem[] | null = null;
  let framingText = '';
  let itemResults: PETAttitudeItemResult[] | null = null;
  let correctCount = 0;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'pet_listening_attitude_plan') {
      const raw = (cj.items as Array<Omit<PETAttitudeClientItem, 'audio_url'> & { audio_url?: string }>) ?? [];
      items = raw.map((item) => ({ ...item, audio_url: item.audio_url ?? '' }));
      framingText = String(cj.framing_text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      itemResults = cj.item_results as PETAttitudeItemResult[];
      correctCount = Number(cj.score ?? 0);
    }
  }

  if (items) return { items, framingText, itemResults, correctCount };
  return null;
}

function AnsweredDot({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.span
      initial={reduceMotion ? false : { scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0"
      aria-hidden
    />
  );
}

function OptionButton({
  optionId,
  text,
  selected,
  onSelect,
  disabled,
  reduceMotion,
}: {
  optionId: 'A' | 'B' | 'C';
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
        'relative rounded-2xl border p-4 text-left text-sm font-semibold text-gray-800 cursor-pointer min-h-12 [&:last-child]:col-span-2',
        disabled ? 'cursor-not-allowed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        selected
          ? {
              background: '#ECFDF5',
              borderColor: ACCENT,
              boxShadow: 'none',
              transform: 'translateY(2px)',
            }
          : { background: CARD_SURFACE, borderColor: '#F3F4F6', boxShadow: '0 3px 0 #e5e7eb' }
      }
    >
      <span className="block pr-6 leading-snug">{text}</span>
      {selected && (
        <motion.span
          initial={reduceMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: ACCENT }}
        >
          <Check size={12} strokeWidth={3.5} className="text-white" />
        </motion.span>
      )}
      <span
        className={[
          'absolute bottom-2 right-2 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center',
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

function QuestionCard({
  item,
  selected,
  onSelect,
  disabled,
  index,
  animate,
  reduceMotion,
}: {
  item: PETAttitudeClientItem;
  selected: 'A' | 'B' | 'C' | undefined;
  onSelect: (v: 'A' | 'B' | 'C') => void;
  disabled: boolean;
  index: number;
  animate: boolean;
  reduceMotion: boolean;
}) {
  const opts = (['A', 'B', 'C'] as const).map((k) => ({ id: k, text: item.options[k] }));

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24, delay: animate ? index * 0.07 : 0 }}
      className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
      style={{ background: CARD_SURFACE }}
    >
      <div className="px-4 pt-4">
        <PETAudioPlayer url={item.audio_url} idleLabel="Listen to the speaker" />
      </div>
      <div className="px-4 pt-3 pb-2 flex items-start gap-2">
        <span
          className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          {item.number}
        </span>
        <p className="text-sm font-semibold text-gray-800 leading-snug flex-1">{item.question}</p>
        {selected && <AnsweredDot reduceMotion={reduceMotion} />}
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        {opts.map((opt) => (
          <OptionButton
            key={opt.id}
            optionId={opt.id}
            text={opt.text}
            selected={selected === opt.id}
            onSelect={() => onSelect(opt.id)}
            disabled={disabled}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>
    </motion.div>
  );
}

function ResultOptionRow({
  optionId,
  text,
  isChosen,
  isCorrectOption,
  reduceMotion,
}: {
  optionId: 'A' | 'B' | 'C';
  text: string;
  isChosen: boolean;
  isCorrectOption: boolean;
  reduceMotion: boolean;
}) {
  const showGreen = isCorrectOption;
  const showRed = isChosen && !isCorrectOption;
  const shake = showRed && !reduceMotion;

  return (
    <motion.div
      initial={false}
      animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={shake ? { duration: 0.4 } : { duration: 0 }}
      className={[
        'relative rounded-2xl border p-4 text-sm font-semibold [&:last-child]:col-span-2',
        showGreen ? 'border-green-400 bg-green-50 text-green-800' : '',
        showRed ? 'border-red-400 bg-red-50 text-red-700' : '',
        !showGreen && !showRed ? 'border-gray-100 text-gray-400 opacity-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={!showGreen && !showRed ? { background: CARD_SURFACE } : undefined}
    >
      <span className="block pr-6 leading-snug">{text}</span>
      {showGreen && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <Check size={12} strokeWidth={3.5} className="text-white" />
        </span>
      )}
      <span
        className={[
          'absolute bottom-2 right-2 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center',
          showGreen ? 'bg-green-500 text-white' : showRed ? 'bg-red-400 text-white' : 'bg-gray-200 text-gray-400',
        ].join(' ')}
        aria-hidden
      >
        {optionId}
      </span>
    </motion.div>
  );
}

function TranscriptBlock({ monologue }: { monologue: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <span>Show transcript</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-2.5">
          <p className="text-xs text-gray-600 leading-relaxed">{monologue}</p>
        </div>
      )}
    </div>
  );
}

function ResultQuestionCard({
  item,
  result,
  index,
  animate,
  reduceMotion,
}: {
  item: PETAttitudeClientItem;
  result: PETAttitudeItemResult;
  index: number;
  animate: boolean;
  reduceMotion: boolean;
}) {
  const opts = (['A', 'B', 'C'] as const).map((k) => ({ id: k, text: item.options[k] }));

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
          {item.number}
        </span>
        <p className="text-sm font-semibold text-gray-800 leading-snug flex-1">{item.question}</p>
        <span
          className={[
            'ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
            result.is_correct ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50',
          ].join(' ')}
        >
          {result.is_correct ? 'Correct' : 'Incorrect'}
        </span>
      </div>
      <div className="px-4 grid grid-cols-2 gap-2">
        {opts.map((opt) => (
          <ResultOptionRow
            key={opt.id}
            optionId={opt.id}
            text={opt.text}
            isChosen={opt.id === result.chosen}
            isCorrectOption={opt.id === result.correct_answer}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>
      <div className="px-4 py-3">
        <TranscriptBlock monologue={item.monologue} />
      </div>
    </motion.div>
  );
}

/** PET Listening Part 4, Attitude & Opinion Detection practice component. */
export function PETListeningAttitudePractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: PETListeningAttitudePracticeProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [planToken, setPlanToken] = useState<string | null>(null);
  const [items, setItems] = useState<PETAttitudeClientItem[]>([]);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C'>>({});
  const [itemResults, setItemResults] = useState<PETAttitudeItemResult[]>([]);
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
        setItems(restored.items);
        setFramingText(restored.framingText);
        if (restored.itemResults) {
          setItemResults(restored.itemResults);
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

      const generated = await generatePETListeningAttitudeAction();

      if (!generated.ok) {
        setLoadErrorCode(generated.code);
        return;
      }
      const result = generated.data;

      setPlanToken(result.planToken);
      setItems(result.items);
      setFramingText(result.framingText);
      setPhase('ready');
    }

    void init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    if (!planToken) return;
    stopActivePETAudio();
    setPhase('submitting');

    const result = await submitPETListeningAttitudeAction({ sessionId, planToken, answers });

    if ('error' in result) {
      setErrorMsg(result.error);
      setPhase('ready');
      return;
    }

    if (!sessionId) onSessionCreated?.(result.sessionId);
    setSessionId(result.sessionId);
    setItemResults(result.item_results);
    setCorrectCount(result.correct_count);
    setPhase('finished');
    onSessionFinished?.();
  }

  const answeredCount = Object.keys(answers).length;
  const allAnswered = items.length > 0 && answeredCount === items.length;
  const progressPct = items.length > 0 ? (answeredCount / items.length) * 100 : 0;

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
          <p className="text-sm font-bold text-gray-800 truncate">Attitude & Opinion</p>
          <p className="text-xs text-gray-400">Listening · Part 4</p>
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

      {phase === 'ready' && items.length > 0 && (
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

              {items.map((item, i) => {
                return (
                  <QuestionCard
                    key={item.number}
                    item={item}
                    index={i}
                    animate={isNewSession}
                    reduceMotion={!!reduceMotion}
                    selected={answers[item.number]}
                    onSelect={(v) => setAnswers((prev) => ({ ...prev, [item.number]: v }))}
                    disabled={false}
                  />
                );
              })}

              <div className="h-20" />
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <div className="mx-auto w-full max-w-lg flex items-center gap-3">
              <p className="text-xs font-semibold text-gray-500 flex-1">
                {answeredCount} of {items.length} answered
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

      {phase === 'finished' && items.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto w-full max-w-lg space-y-4">
            {items.map((item, i) => {
              const result = itemResults.find((r) => r.number === item.number);
              if (!result) return null;
              return (
                <ResultQuestionCard
                  key={item.number}
                  item={item}
                  result={result}
                  index={i}
                  animate={isNewSession}
                  reduceMotion={!!reduceMotion}
                />
              );
            })}

            <div className="flex justify-center pt-2">
              <CelebrationCard
                score={correctCount}
                scoreMax={items.length}
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
