'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { KETReadingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import {
  generateKETVocabGapAction,
  submitKETVocabGapAction,
  type VocabGapExercise,
  type VocabGapItemResult,
  type VocabGapItem,
} from '@/actions/modes/ket-reading-part4';
import type { StoredMessage } from '@/actions/messages';

const ACCENT = '#469E7B';
const ACCENT_DARK = '#37795E';
const ACCENT_TEXT = '#2F6B52';
const ACCENT_TINT = 'color-mix(in oklab, #469E7B 14%, white)';
const CARD_SURFACE = '#FAFAF8';

export interface KETVocabGapPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';
type OptionKey = 'A' | 'B' | 'C';

interface RestoredState {
  exercise: VocabGapExercise;
  framingText: string;
  results: VocabGapItemResult[] | null;
  correctCount: number;
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let exercise: VocabGapExercise | null = null;
  let framingText = '';
  let results: VocabGapItemResult[] | null = null;
  let correctCount = 0;
  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;
    if (msg.role === 'bob' && cj.kind === 'reading_vocab_gap_plan') {
      exercise = cj.exercise as VocabGapExercise;
      framingText = String(cj.framing_text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      results = cj.item_results as VocabGapItemResult[];
      correctCount = Number(cj.score ?? 0);
    }
  }
  return exercise ? { exercise, framingText, results, correctCount } : null;
}

/**
 * Renders the exercise text with the active gap highlighted as a chip and the
 * other gaps shown as quiet underscores, so the child reads one sentence in
 * context while focusing on a single decision.
 */
function FocusedText({
  text,
  items,
  answers,
  activeNumber,
}: {
  text: string;
  items: VocabGapItem[];
  answers: Record<number, OptionKey | null>;
  activeNumber: number;
}) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="text-base text-gray-700 leading-loose">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (!match) return <span key={i}>{part}</span>;
        const n = parseInt(match[1], 10);
        const item = items.find((it) => it.number === n);
        if (!item) return <span key={i} className="text-red-400">[?]</span>;

        const selected = answers[n];
        const word = selected ? item.options[selected] : null;
        const isActive = n === activeNumber;

        if (isActive) {
          return (
            <span
              key={i}
              className="inline-flex items-center justify-center mx-0.5 px-3 py-0.5 rounded-xl text-base font-bold align-middle min-w-16"
              style={{ background: ACCENT_TINT, color: ACCENT_TEXT, outline: `2px solid ${ACCENT}` }}
            >
              {word ?? '?'}
            </span>
          );
        }

        return (
          <span
            key={i}
            className={`inline-flex items-center justify-center mx-0.5 px-2 py-0.5 rounded-lg text-sm font-semibold align-middle ${
              word ? 'bg-gray-100 text-gray-500' : 'text-gray-300'
            }`}
          >
            {word ?? '_____'}
          </span>
        );
      })}
    </p>
  );
}

function WordOption({
  word,
  optionId,
  selected,
  onSelect,
  reduceMotion,
}: {
  word: string;
  optionId: OptionKey;
  selected: boolean;
  onSelect: () => void;
  reduceMotion: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className="relative rounded-2xl border p-4 text-center text-base font-bold text-gray-800 cursor-pointer min-h-14 flex items-center justify-center"
      style={
        selected
          ? { background: ACCENT_TINT, borderColor: ACCENT, boxShadow: 'none', transform: 'translateY(2px)' }
          : { background: CARD_SURFACE, borderColor: '#F3F4F6', boxShadow: '0 3px 0 #e5e7eb' }
      }
    >
      <span className="leading-snug">{word}</span>
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

function ProgressDots({
  items,
  answers,
  activeIndex,
  onJump,
}: {
  items: VocabGapItem[];
  answers: Record<number, OptionKey | null>;
  activeIndex: number;
  onJump: (index: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {items.map((item, i) => {
        const answered = answers[item.number] != null;
        const active = i === activeIndex;
        return (
          <button
            key={item.number}
            type="button"
            onClick={() => onJump(i)}
            aria-label={`Gap ${item.number}`}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-95"
            style={{
              background: active ? ACCENT : answered ? ACCENT_TINT : '#F3F4F6',
              color: active ? 'white' : answered ? ACCENT_TEXT : '#9CA3AF',
            }}
          >
            <span className="text-xs font-black">{item.number}</span>
          </button>
        );
      })}
    </div>
  );
}

function ResultText({
  text,
  items,
  results,
}: {
  text: string;
  items: VocabGapItem[];
  results: VocabGapItemResult[];
}) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="text-base text-gray-700 leading-loose">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (!match) return <span key={i}>{part}</span>;
        const n = parseInt(match[1], 10);
        const item = items.find((it) => it.number === n);
        const r = results.find((res) => res.number === n);
        if (!item || !r) return <span key={i} className="text-red-400">[?]</span>;
        const chosenWord = r.chosen ? item.options[r.chosen] : '—';
        const correctWord = item.options[r.correct_answer];
        if (r.is_correct) {
          return (
            <span key={i} className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-lg text-sm font-bold align-middle bg-green-50 border border-green-300 text-green-800">
              {chosenWord}
              <Check size={12} strokeWidth={3.5} className="text-green-500" />
            </span>
          );
        }
        return (
          <span key={i} className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-lg text-sm font-bold align-middle bg-red-50 border border-red-300 text-red-700">
            <span className="line-through">{chosenWord}</span>
            <span className="text-gray-400">→</span>
            <span className="text-green-700">{correctWord}</span>
          </span>
        );
      })}
    </p>
  );
}

/** KET Reading Part 4 — Vocabulary Gap-Fill practice in focus mode. */
export function KETVocabGapPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETVocabGapPracticeProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [exercise, setExercise] = useState<VocabGapExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, OptionKey | null>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<VocabGapItemResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    async function init() {
      if (initialMessages?.length) {
        const r = tryRestore(initialMessages);
        if (r) {
          setExercise(r.exercise);
          setFramingText(r.framingText);
          if (r.results) {
            setResults(r.results);
            setCorrectCount(r.correctCount);
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
      const result = await generateKETVocabGapAction({ sessionId: initialSessionId });
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

  function handleSelect(itemNumber: number, key: OptionKey) {
    if (!exercise) return;
    setAnswers((prev) => ({ ...prev, [itemNumber]: key }));
    const nextUnanswered = exercise.items.findIndex(
      (it, i) => i > activeIndex && answers[it.number] == null
    );
    if (nextUnanswered !== -1) {
      window.setTimeout(() => setActiveIndex(nextUnanswered), 220);
    } else if (activeIndex < exercise.items.length - 1) {
      window.setTimeout(() => setActiveIndex(activeIndex + 1), 220);
    }
  }

  async function handleSubmit() {
    if (!sessionId || !userId || !exercise) return;
    setPhase('submitting');
    const result = await submitKETVocabGapAction({ sessionId, userId, answers, items: exercise.items });
    if ('error' in result) {
      setErrorMsg(result.error);
      setPhase('ready');
      return;
    }
    setResults(result.item_results);
    setCorrectCount(result.correct_count);
    setPhase('finished');
    onSessionFinished?.();
  }

  const answeredCount = exercise
    ? exercise.items.filter((it) => answers[it.number] != null).length
    : 0;
  const allAnswered = exercise ? answeredCount === exercise.items.length : false;
  const progressPct = exercise && exercise.items.length > 0 ? (answeredCount / exercise.items.length) * 100 : 0;
  const activeItem = exercise?.items[activeIndex];

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
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT_TINT, color: ACCENT }}>
          <KETReadingIcon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">Choose the Word</p>
          <p className="text-xs text-gray-400">Reading · Part 4</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}>
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

      {phase === 'ready' && exercise && activeItem && (
        <>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="mx-auto w-full max-w-lg space-y-4 pt-4">
              <div className="flex items-start gap-3 rounded-3xl border border-gray-100 shadow-sm px-4 py-3" style={{ background: CARD_SURFACE }}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT_TINT, color: ACCENT }}>
                  <KETReadingIcon size={20} />
                </span>
                <p className="text-sm text-gray-700 leading-relaxed flex-1">{framingText}</p>
              </div>

              <div className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden" style={{ background: CARD_SURFACE }}>
                <div className="px-4 py-3 border-b border-gray-100" style={{ background: ACCENT_TINT }}>
                  <p className="text-sm font-bold" style={{ color: ACCENT_TEXT }}>{exercise.title}</p>
                </div>
                <div className="px-4 py-4">
                  <FocusedText text={exercise.text} items={exercise.items} answers={answers} activeNumber={activeItem.number} />
                </div>
              </div>

              <ProgressDots items={exercise.items} answers={answers} activeIndex={activeIndex} onJump={setActiveIndex} />

              <motion.div
                key={activeItem.number}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                className="grid grid-cols-1 gap-2.5"
              >
                {(['A', 'B', 'C'] as const).map((k) => (
                  <WordOption
                    key={k}
                    word={activeItem.options[k]}
                    optionId={k}
                    selected={answers[activeItem.number] === k}
                    onSelect={() => handleSelect(activeItem.number, k)}
                    reduceMotion={!!reduceMotion}
                  />
                ))}
              </motion.div>

              <div className="h-20" />
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <div className="mx-auto w-full max-w-lg flex items-center gap-3">
              <p className="text-xs font-semibold text-gray-500 flex-1">
                {answeredCount} of {exercise.items.length} answered
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
              className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
              style={{ background: CARD_SURFACE }}
            >
              <div className="px-4 py-3 border-b border-gray-100" style={{ background: ACCENT_TINT }}>
                <p className="text-sm font-bold" style={{ color: ACCENT_TEXT }}>{exercise.title}</p>
              </div>
              <div className="px-4 py-4">
                <ResultText text={exercise.text} items={exercise.items} results={results} />
              </div>
            </motion.div>

            <div className="flex justify-center pt-2">
              <CelebrationCard
                score={correctCount}
                scoreMax={exercise.items.length}
                feedback="Great reading practice!"
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
