'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { KETReadingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import {
  generateKETLongTextAction,
  submitKETLongTextAction,
  type LongTextExercise,
  type LongTextItem,
  type LongTextItemResult,
} from '@/actions/modes/ket-reading-part3';
import type { StoredMessage } from '@/actions/messages';

const ACCENT = '#469E7B';
const ACCENT_DARK = '#37795E';
const ACCENT_TEXT = '#2F6B52';
const ACCENT_TINT = 'color-mix(in oklab, #469E7B 14%, white)';
const CARD_SURFACE = '#FAFAF8';

export interface KETLongTextPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'reading' | 'answering' | 'submitting' | 'finished';
type Choice = 'A' | 'B' | 'C';

function tryRestore(messages: StoredMessage[]): { exercise: LongTextExercise; framingText: string; results: LongTextItemResult[] | null; correctCount: number } | null {
  let exercise: LongTextExercise | null = null;
  let framingText = '';
  let results: LongTextItemResult[] | null = null;
  let correctCount = 0;
  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;
    if (msg.role === 'bob' && cj.kind === 'reading_long_plan') { exercise = cj.exercise as LongTextExercise; framingText = String(cj.framing_text ?? ''); }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) { results = cj.item_results as LongTextItemResult[]; correctCount = Number(cj.score ?? 0); }
  }
  return exercise ? { exercise, framingText, results, correctCount } : null;
}

function ProgressDots({
  items,
  answers,
  current,
  onJump,
}: {
  items: LongTextItem[];
  answers: Record<number, Choice | null>;
  current: number;
  onJump: (index: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {items.map((item, i) => {
        const done = answers[item.number] != null;
        const isCurrent = i === current;
        return (
          <button
            key={item.number}
            type="button"
            onClick={() => onJump(i)}
            aria-label={`Question ${i + 1}`}
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

function OptionCard({
  optionId,
  text,
  selected,
  onSelect,
  disabled,
  reduceMotion,
}: {
  optionId: Choice;
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
        'relative rounded-2xl border-2 p-4 text-left text-sm font-semibold text-gray-800 cursor-pointer min-h-16 [&:last-child]:col-span-2',
        disabled ? 'cursor-not-allowed' : '',
      ].filter(Boolean).join(' ')}
      style={
        selected
          ? { background: '#F0F7F3', borderColor: ACCENT, boxShadow: 'none', transform: 'translateY(2px)' }
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

function ResultOptionRow({
  optionId,
  text,
  isChosen,
  isCorrectOption,
}: {
  optionId: Choice;
  text: string;
  isChosen: boolean;
  isCorrectOption: boolean;
}) {
  const showGreen = isCorrectOption;
  const showRed = isChosen && !isCorrectOption;
  return (
    <div
      className={[
        'relative rounded-2xl border p-4 text-sm font-semibold [&:last-child]:col-span-2',
        showGreen ? 'border-green-400 bg-green-50 text-green-800' : '',
        showRed ? 'border-red-400 bg-red-50 text-red-700' : '',
        !showGreen && !showRed ? 'border-gray-100 text-gray-400 opacity-50' : '',
      ].filter(Boolean).join(' ')}
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
    </div>
  );
}

function PassageSheet({
  title,
  text,
  open,
  onClose,
  reduceMotion,
}: {
  title: string;
  text: string;
  open: boolean;
  onClose: () => void;
  reduceMotion: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[72dvh] rounded-t-3xl bg-white shadow-2xl flex flex-col"
            initial={reduceMotion ? { y: 0 } : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 34 }}
            role="dialog"
            aria-label="Read the text again"
          >
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <span className="block w-10 h-1.5 rounded-full bg-gray-200" aria-hidden />
            </div>
            <div className="px-5 pb-2 flex items-center gap-2 shrink-0">
              <p className="text-sm font-bold text-gray-800 flex-1 truncate">{title}</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 cursor-pointer text-lg"
              >
                ✕
              </button>
            </div>
            <div className="px-5 pb-6 overflow-y-auto">
              <p className="text-base text-gray-700 leading-loose whitespace-pre-line">{text}</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** KET Reading Part 3 — Long Text Comprehension focus-mode practice component. */
export function KETLongTextPractice({
  onBack, sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished, onOpenDashboard,
}: KETLongTextPracticeProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [exercise, setExercise] = useState<LongTextExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, Choice | null>>({});
  const [results, setResults] = useState<LongTextItemResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [current, setCurrent] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const initRef = useRef(false);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    async function init() {
      if (initialMessages?.length) {
        const r = tryRestore(initialMessages);
        if (r) {
          setExercise(r.exercise); setFramingText(r.framingText);
          if (r.results) { setResults(r.results); setCorrectCount(r.correctCount); setPhase('finished'); }
          else { const { createSupabaseBrowser } = await import('@/lib/supabase/browser-client'); const { data: { user } } = await createSupabaseBrowser().auth.getUser(); if (user) setUserId(user.id); setPhase('reading'); }
          return;
        }
      }
      if (initialSessionId) return;
      setIsNewSession(true); setPhase('generating');
      const result = await generateKETLongTextAction({ sessionId: initialSessionId });
      if ('error' in result) { setErrorMsg(result.error); return; }
      onSessionCreated?.(result.sessionId); setSessionId(result.sessionId); setUserId(result.userId);
      setExercise(result.exercise); setFramingText(result.framing_text); setPhase('reading');
    }
    void init();
  }, []);

  useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current); }, []);

  function handlePick(itemNumber: number, choice: Choice, index: number, total: number) {
    setAnswers((prev) => ({ ...prev, [itemNumber]: choice }));
    if (advanceRef.current) clearTimeout(advanceRef.current);
    if (index < total - 1) {
      const delay = reduceMotion ? 120 : 400;
      advanceRef.current = setTimeout(() => setCurrent((c) => (c === index ? index + 1 : c)), delay);
    }
  }

  async function handleSubmit() {
    if (!sessionId || !userId || !exercise) return;
    setPhase('submitting');
    const result = await submitKETLongTextAction({ sessionId, userId, answers, items: exercise.items });
    if ('error' in result) { setErrorMsg(result.error); setPhase('answering'); return; }
    setResults(result.item_results); setCorrectCount(result.correct_count); setPhase('finished'); onSessionFinished?.();
  }

  const answeredCount = exercise ? Object.values(answers).filter((v) => v != null).length : 0;
  const allAnswered = exercise ? answeredCount === exercise.items.length : false;

  if (errorMsg) return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
      <p className="text-red-500 font-semibold">{errorMsg}</p>
      <button type="button" onClick={onBack} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm">Back</button>
    </div>
  );

  const currentItem = exercise?.items[current];

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
          <p className="text-sm font-bold text-gray-800 truncate">Read and Decide</p>
          <p className="text-xs text-gray-400">Reading · Part 3</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}>A2</span>
      </div>

      {(phase === 'loading' || phase === 'generating') && <div className="flex-1 flex flex-col min-h-0"><BobMascotLoader message="Preparing exercise…" /></div>}
      {phase === 'submitting' && <div className="flex-1 flex flex-col min-h-0"><BobMascotLoader message="Checking your answers…" /></div>}

      {phase === 'reading' && exercise && (
        <>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="mx-auto w-full max-w-lg flex flex-col gap-4 pt-4">
              <div className="flex items-start gap-3 rounded-3xl border border-gray-100 shadow-sm px-4 py-3" style={{ background: CARD_SURFACE }}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT_TINT, color: ACCENT }}>
                  <KETReadingIcon size={20} />
                </span>
                <p className="text-sm text-gray-700 leading-relaxed flex-1">{framingText}</p>
              </div>

              <div className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden" style={{ background: CARD_SURFACE }}>
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-base font-bold text-gray-800">{exercise.title}</p>
                </div>
                <p className="px-5 py-5 text-base text-gray-700 leading-loose whitespace-pre-line">{exercise.text}</p>
              </div>

              <div className="h-2" />
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <div className="mx-auto w-full max-w-lg">
              <button
                type="button"
                onClick={() => setPhase('answering')}
                className="w-full px-6 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 cursor-pointer active:translate-y-1 active:shadow-none"
                style={{ background: ACCENT, boxShadow: `0 4px 0 ${ACCENT_DARK}` }}
              >
                Ready? Answer the questions →
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'answering' && exercise && currentItem && (
        <>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="mx-auto w-full max-w-lg flex flex-col gap-4 pt-4">
              <ProgressDots
                items={exercise.items}
                answers={answers}
                current={current}
                onJump={(i) => { if (advanceRef.current) clearTimeout(advanceRef.current); setCurrent(i); }}
              />

              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="self-center sticky top-2 z-10 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border cursor-pointer shadow-sm"
                style={{ background: ACCENT_TINT, color: ACCENT_TEXT, borderColor: 'transparent' }}
              >
                📄 Read the text again ▾
              </button>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentItem.number}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="flex flex-col gap-3"
                >
                  <div className="rounded-3xl border border-gray-100 shadow-sm px-4 py-4 flex items-start gap-3" style={{ background: CARD_SURFACE }}>
                    <span className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5" style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}>
                      {currentItem.number}
                    </span>
                    <p className="text-base font-semibold text-gray-800 leading-snug flex-1">{currentItem.question}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {(['A', 'B', 'C'] as const).map((k) => (
                      <OptionCard
                        key={k}
                        optionId={k}
                        text={currentItem.options[k]}
                        selected={answers[currentItem.number] === k}
                        onSelect={() => handlePick(currentItem.number, k, current, exercise.items.length)}
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

          <PassageSheet
            title={exercise.title}
            text={exercise.text}
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            reduceMotion={!!reduceMotion}
          />
        </>
      )}

      {phase === 'finished' && exercise && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto w-full max-w-lg flex flex-col gap-4">
            <div className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden" style={{ background: CARD_SURFACE }}>
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-800">{exercise.title}</p>
              </div>
              <p className="px-4 py-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{exercise.text}</p>
            </div>

            {exercise.items.map((item, i) => {
              const r = results.find((res) => res.number === item.number);
              if (!r) return null;
              return (
                <motion.div
                  key={item.number}
                  initial={isNewSession && !reduceMotion ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 24, delay: isNewSession ? i * 0.07 : 0 }}
                  className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
                  style={{ background: CARD_SURFACE }}
                >
                  <div className="px-4 pt-4 pb-2 flex items-start gap-2">
                    <span className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5" style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}>{item.number}</span>
                    <p className="text-sm font-semibold text-gray-800 leading-snug flex-1">{item.question}</p>
                    <span
                      className={[
                        'ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                        r.is_correct ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50',
                      ].join(' ')}
                    >
                      {r.is_correct ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                  <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                    {(['A', 'B', 'C'] as const).map((k) => (
                      <ResultOptionRow
                        key={k}
                        optionId={k}
                        text={item.options[k]}
                        isChosen={k === r.chosen}
                        isCorrectOption={k === r.correct_answer}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}

            <div className="flex justify-center pt-2">
              <CelebrationCard score={correctCount} scoreMax={exercise.items.length} feedback="Great reading practice!" onAction={onOpenDashboard} actionLabel="See my progress" animate={isNewSession} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
