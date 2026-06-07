'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, CheckCircle, XCircle } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { KETReadingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import {
  generateKETMatchQuestionAction,
  submitKETMatchQuestionAction,
  type MatchExercise,
  type ReadingText,
  type MatchQuestion,
  type QuestionResult,
} from '@/actions/modes/ket-reading-part2';
import type { StoredMessage } from '@/actions/messages';

const ACCENT = '#469E7B';
const ACCENT_DARK = '#37795E';
const ACCENT_TEXT = '#2F6B52';
const ACCENT_TINT = 'color-mix(in oklab, #469E7B 14%, white)';
const CARD_SURFACE = '#FAFAF8';

type TextLabel = 'A' | 'B' | 'C';

export interface KETMatchQuestionPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';

function tryRestore(messages: StoredMessage[]): { exercise: MatchExercise; framingText: string; results: QuestionResult[] | null; correctCount: number } | null {
  let exercise: MatchExercise | null = null;
  let framingText = '';
  let results: QuestionResult[] | null = null;
  let correctCount = 0;
  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;
    if (msg.role === 'bob' && cj.kind === 'reading_match_plan') { exercise = cj.exercise as MatchExercise; framingText = String(cj.framing_text ?? ''); }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) { results = cj.question_results as QuestionResult[]; correctCount = Number(cj.score ?? 0); }
  }
  return exercise ? { exercise, framingText, results, correctCount } : null;
}

function LetterChip({ letter, className }: { letter: string; className?: string }) {
  return (
    <span
      className={[
        'w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0',
        className ?? '',
      ].join(' ')}
      style={className ? undefined : { background: ACCENT_TINT, color: ACCENT_TEXT }}
    >
      {letter}
    </span>
  );
}

function ProgressDots({
  questions,
  answers,
  activeQuestion,
  reduceMotion,
  onJump,
}: {
  questions: MatchQuestion[];
  answers: Record<number, TextLabel | null>;
  activeQuestion: number | null;
  reduceMotion: boolean;
  onJump: (number: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-2.5">
      {questions.map((q) => {
        const done = !!answers[q.number];
        const active = activeQuestion === q.number;
        return (
          <button
            key={q.number}
            type="button"
            onClick={() => onJump(q.number)}
            aria-label={`Question ${q.number}${done ? ', answered' : ''}`}
            className="relative w-8 h-8 flex items-center justify-center rounded-full"
          >
            {active && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: `0 0 0 2px ${ACCENT}` }}
                initial={false}
                animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 0.4, 1] }}
                transition={reduceMotion ? { duration: 0 } : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            <span
              className={[
                'relative w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors',
                done ? 'text-white' : active ? '' : 'text-gray-400',
              ].join(' ')}
              style={{
                background: done ? ACCENT : active ? ACCENT_TINT : '#E5E7EB',
                color: done ? '#fff' : active ? ACCENT_TEXT : undefined,
              }}
            >
              {done ? <Check size={12} strokeWidth={3.5} /> : q.number}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ActiveQuestionCard({
  question,
  matchedLabel,
  matchedAuthor,
  reduceMotion,
  onClearSlot,
}: {
  question: MatchQuestion;
  matchedLabel: TextLabel | null;
  matchedAuthor: string | null;
  reduceMotion: boolean;
  onClearSlot: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `question-${question.number}` });

  return (
    <motion.div
      key={question.number}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
      style={{ background: CARD_SURFACE }}
    >
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <span
          className="w-9 h-9 rounded-full text-sm font-black flex items-center justify-center shrink-0"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          {question.number}
        </span>
        <span className="text-base font-bold text-gray-800 flex-1 leading-snug">{question.text}</span>
      </div>

      <div className="px-4 pb-4">
        <motion.button
          ref={setNodeRef}
          type="button"
          onClick={matchedLabel ? onClearSlot : undefined}
          animate={{ scale: isOver ? 1.02 : 1 }}
          transition={{ duration: 0.2 }}
          className={[
            'w-full min-h-[60px] rounded-2xl px-3 py-3 flex items-center gap-2.5 text-left transition-colors',
            matchedLabel ? 'cursor-pointer' : 'cursor-default',
            isOver || matchedLabel
              ? 'border-2'
              : 'border-2 border-dashed',
          ].join(' ')}
          style={
            isOver || matchedLabel
              ? { background: ACCENT_TINT, borderColor: ACCENT }
              : { background: '#fff', borderColor: '#9FD0BC' }
          }
        >
          {matchedLabel ? (
            <>
              <LetterChip letter={matchedLabel} />
              <span className="text-sm font-semibold text-gray-700 leading-snug flex-1">{matchedAuthor}</span>
            </>
          ) : (
            <span className="text-sm font-semibold flex-1" style={{ color: ACCENT_TEXT }}>
              Drag or tap a text
            </span>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

function TextCardBody({ text }: { text: ReadingText }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 text-white"
          style={{ background: ACCENT }}
        >
          {text.label}
        </span>
        <span className="text-xs font-bold text-gray-700">{text.author}</span>
      </div>
      <p className="text-xs font-medium text-gray-600 leading-snug">{text.text}</p>
    </>
  );
}

function TextCard({
  text,
  chosen,
  dragging,
  onTap,
}: {
  text: ReadingText;
  chosen: boolean;
  dragging: boolean;
  onTap: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `text-${text.label}`,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onTap}
      aria-label={`Text ${text.label} by ${text.author}`}
      className={[
        'relative w-full rounded-2xl px-3 py-3 flex flex-col gap-1.5 text-left border-2 transition-all touch-none select-none cursor-grab',
        chosen ? 'bg-white' : 'border-gray-200 bg-white hover:border-gray-300',
        dragging || isDragging ? 'opacity-30' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={chosen ? { borderColor: ACCENT, background: ACCENT_TINT } : undefined}
      {...attributes}
      {...listeners}
    >
      <TextCardBody text={text} />
      {chosen && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
          style={{ background: ACCENT }}
          aria-hidden
        >
          <Check size={12} strokeWidth={3.5} />
        </motion.span>
      )}
    </button>
  );
}

function QuestionResultCard({
  result,
  question,
  texts,
  animate,
  reduceMotion,
}: {
  result: QuestionResult;
  question: MatchQuestion | undefined;
  texts: ReadingText[];
  animate: boolean;
  reduceMotion: boolean;
}) {
  const correctText = texts.find((t) => t.label === result.correct_answer);
  const chosenText = result.chosen ? texts.find((t) => t.label === result.chosen) : null;
  const shake = animate && !reduceMotion && !result.is_correct;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={shake ? { opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] } : { opacity: 1, y: 0 }}
      transition={
        shake
          ? { type: 'spring', stiffness: 280, damping: 24, delay: result.number * 0.08, x: { duration: 0.4, delay: result.number * 0.08 } }
          : { type: 'spring', stiffness: 280, damping: 24, delay: result.number * 0.08 }
      }
      className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
      style={{ background: CARD_SURFACE }}
    >
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-2">
        <span
          className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          {result.number}
        </span>
        <span className="text-sm font-bold text-gray-800 flex-1 leading-snug">{question?.text}</span>
        {result.is_correct ? (
          <CheckCircle size={18} className="text-green-500 shrink-0" />
        ) : (
          <XCircle size={18} className="text-red-400 shrink-0" />
        )}
      </div>

      <div className="px-4 pb-4 space-y-2">
        {result.is_correct ? (
          <div className="min-h-[48px] rounded-2xl px-3 py-2 flex items-start gap-2 border-2 border-green-300 bg-green-50">
            <LetterChip letter={result.correct_answer} className="bg-green-200 text-green-800" />
            <span className="text-xs font-semibold text-green-800 leading-snug pt-0.5">{correctText?.author}</span>
          </div>
        ) : (
          <>
            <div className="min-h-[48px] rounded-2xl px-3 py-2 flex items-start gap-2 border-2 border-red-300 bg-red-50">
              {result.chosen ? (
                <>
                  <LetterChip letter={result.chosen} className="bg-red-200 text-red-700" />
                  <span className="text-xs font-semibold text-red-600 line-through leading-snug pt-0.5">{chosenText?.author}</span>
                </>
              ) : (
                <span className="text-xs font-semibold text-red-400 italic pt-0.5">No answer selected</span>
              )}
            </div>
            <div className="min-h-[48px] rounded-2xl px-3 py-2 flex items-start gap-2 border-2 border-green-300 bg-green-50">
              <LetterChip letter={result.correct_answer} className="bg-green-200 text-green-800" />
              <span className="text-xs font-semibold text-green-800 leading-snug pt-0.5">{correctText?.author}</span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

/** KET Reading Part 2 — Multiple Matching practice with focus-mode drag-and-drop (tap fallback). */
export function KETMatchQuestionPractice({
  onBack, sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished, onOpenDashboard,
}: KETMatchQuestionPracticeProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [exercise, setExercise] = useState<MatchExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, TextLabel | null>>({});
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [draggingLabel, setDraggingLabel] = useState<TextLabel | null>(null);
  const initRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    async function init() {
      if (initialMessages?.length) {
        const r = tryRestore(initialMessages);
        if (r) {
          setExercise(r.exercise); setFramingText(r.framingText);
          if (r.results) { setResults(r.results); setCorrectCount(r.correctCount); setPhase('finished'); }
          else { const { createSupabaseBrowser } = await import('@/lib/supabase/browser-client'); const { data: { user } } = await createSupabaseBrowser().auth.getUser(); if (user) setUserId(user.id); setPhase('ready'); }
          return;
        }
      }
      if (initialSessionId) return;
      setIsNewSession(true); setPhase('generating');
      const result = await generateKETMatchQuestionAction({ sessionId: initialSessionId });
      if ('error' in result) { setErrorMsg(result.error); return; }
      onSessionCreated?.(result.sessionId); setSessionId(result.sessionId); setUserId(result.userId);
      setExercise(result.exercise); setFramingText(result.framing_text); setPhase('ready');
    }
    void init();
  }, []);

  function firstUnanswered(questions: MatchQuestion[], current: Record<number, TextLabel | null>): number | null {
    const target = questions.find((q) => !current[q.number]);
    return target ? target.number : null;
  }

  useEffect(() => {
    if (phase !== 'ready' || !exercise || activeQuestion !== null) return;
    const next = firstUnanswered(exercise.questions, answers);
    setActiveQuestion(next ?? exercise.questions[0]?.number ?? null);
  }, [phase, exercise, activeQuestion, answers]);

  function nextUnansweredAfter(assigned: Record<number, TextLabel | null>, justFilled: number): number | null {
    if (!exercise) return null;
    const order = exercise.questions.map((q) => q.number);
    const startIdx = order.indexOf(justFilled);
    for (let step = 1; step <= order.length; step += 1) {
      const candidate = order[(startIdx + step) % order.length];
      if (!assigned[candidate]) return candidate;
    }
    return null;
  }

  function assignToActive(label: TextLabel) {
    if (activeQuestion === null) return;
    assignAnswer(activeQuestion, label, true);
  }

  function assignAnswer(questionNumber: number, label: TextLabel, advance: boolean) {
    setAnswers((prev) => {
      const next: Record<number, TextLabel | null> = { ...prev, [questionNumber]: label };
      if (advance) {
        const upcoming = nextUnansweredAfter(next, questionNumber);
        if (upcoming !== null) setActiveQuestion(upcoming);
      }
      return next;
    });
  }

  function handleJumpToQuestion(number: number) {
    setActiveQuestion(number);
  }

  function handleClearActiveSlot() {
    if (activeQuestion === null) return;
    setAnswers((prev) => {
      if (!prev[activeQuestion]) return prev;
      const next = { ...prev };
      next[activeQuestion] = null;
      return next;
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const raw = String(event.active.id);
    if (raw.startsWith('text-')) setDraggingLabel(raw.slice('text-'.length) as TextLabel);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingLabel(null);
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!activeId.startsWith('text-') || !overId || !overId.startsWith('question-')) return;
    const label = activeId.slice('text-'.length) as TextLabel;
    const questionNumber = Number(overId.slice('question-'.length));
    if (!Number.isFinite(questionNumber)) return;
    assignAnswer(questionNumber, label, true);
  }

  async function handleSubmit() {
    if (!sessionId || !userId || !exercise) return;
    setActiveQuestion(null);
    setPhase('submitting');
    const result = await submitKETMatchQuestionAction({ sessionId, userId, answers, questions: exercise.questions });
    if ('error' in result) { setErrorMsg(result.error); setPhase('ready'); return; }
    setResults(result.question_results); setCorrectCount(result.correct_count); setPhase('finished'); onSessionFinished?.();
  }

  const answeredCount = Object.values(answers).filter((v) => v !== null).length;
  const total = exercise ? exercise.questions.length : 0;
  const allAnswered = exercise ? answeredCount === total : false;
  const progressPct = total > 0 ? (answeredCount / total) * 100 : 0;

  if (errorMsg) return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
      <p className="text-red-500 font-semibold">{errorMsg}</p>
      <button type="button" onClick={onBack} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm">Back</button>
    </div>
  );

  const textByLabel = new Map((exercise?.texts ?? []).map((t) => [t.label, t]));
  const activeQuestionObj =
    exercise && activeQuestion !== null ? exercise.questions.find((q) => q.number === activeQuestion) ?? null : null;
  const activeMatchedLabel = activeQuestion !== null ? answers[activeQuestion] ?? null : null;

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
          <p className="text-sm font-bold text-gray-800 truncate">Match the Question</p>
          <p className="text-xs text-gray-400">Reading · Part 2</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}>A2</span>
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

      {(phase === 'loading' || phase === 'generating') && <div className="flex-1 flex flex-col min-h-0"><BobMascotLoader message="Preparing exercise…" /></div>}
      {phase === 'submitting' && <div className="flex-1 flex flex-col min-h-0"><BobMascotLoader message="Checking your answers…" /></div>}

      {phase === 'ready' && exercise && activeQuestionObj && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="shrink-0 px-4 pt-3 bg-white">
            <div className="mx-auto w-full max-w-lg space-y-3">
              <div className="rounded-3xl border border-gray-100 shadow-sm px-4 py-3 flex items-start gap-3" style={{ background: CARD_SURFACE }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT_TINT, color: ACCENT }}>
                  <KETReadingIcon size={18} />
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{framingText}</p>
              </div>

              <ProgressDots
                questions={exercise.questions}
                answers={answers}
                activeQuestion={activeQuestion}
                reduceMotion={!!reduceMotion}
                onJump={handleJumpToQuestion}
              />

              <ActiveQuestionCard
                question={activeQuestionObj}
                matchedLabel={activeMatchedLabel}
                matchedAuthor={activeMatchedLabel ? textByLabel.get(activeMatchedLabel)?.author ?? null : null}
                reduceMotion={!!reduceMotion}
                onClearSlot={handleClearActiveSlot}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4">
            <div className="mx-auto w-full max-w-lg space-y-2.5">
              <p className="text-sm font-bold text-gray-700">Who is it?</p>
              <div className="space-y-2">
                {exercise.texts.map((text) => (
                  <TextCard
                    key={text.label}
                    text={text}
                    chosen={activeMatchedLabel === text.label}
                    dragging={draggingLabel === text.label}
                    onTap={() => assignToActive(text.label)}
                  />
                ))}
              </div>
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {draggingLabel ? (
              <div
                className="rounded-2xl px-3 py-3 flex flex-col gap-1.5 border-2 shadow-lg max-w-[18rem] bg-white"
                style={{ borderColor: ACCENT, cursor: 'grabbing' }}
              >
                <TextCardBody text={textByLabel.get(draggingLabel) ?? { label: draggingLabel, author: '', text: '' }} />
              </div>
            ) : null}
          </DragOverlay>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <div className="mx-auto w-full max-w-lg flex items-center gap-3">
              <p className="text-xs font-semibold text-gray-500 flex-1">{answeredCount} of {total} answered</p>
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
        </DndContext>
      )}

      {phase === 'finished' && exercise && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto w-full max-w-lg space-y-3">
            {results.map((r) => (
              <QuestionResultCard
                key={r.number}
                result={r}
                question={exercise.questions.find((q) => q.number === r.number)}
                texts={exercise.texts}
                animate={isNewSession}
                reduceMotion={!!reduceMotion}
              />
            ))}

            <div className="flex justify-center pt-2">
              <CelebrationCard score={correctCount} scoreMax={exercise.questions.length} feedback="Great reading practice!" onAction={onOpenDashboard} actionLabel="See my progress" animate={isNewSession} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
