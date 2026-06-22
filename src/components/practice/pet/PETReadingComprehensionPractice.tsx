'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { PETReadingIcon } from '@/components/icons/PETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import {
  generatePETReadingComprehensionAction,
  submitPETReadingComprehensionAction,
  type PETReadingClientQuestion,
  type PETReadingQuestionResult,
  type PETReadingAnswer,
} from '@/actions/modes/pet-reading-comprehension';
import type { StoredMessage } from '@/actions/messages';

const ACCENT_RING = 'border-emerald-200';

type Section = 'comprehension' | 'vocabulary' | 'grammar';

const SECTION_META: Record<Section, { title: string; subtitle: string }> = {
  comprehension: { title: 'Comprehension', subtitle: 'Understanding the text' },
  vocabulary: { title: 'Vocabulary', subtitle: 'Words and meaning' },
  grammar: { title: 'Grammar', subtitle: 'Structures and tenses' },
};

const SECTION_ORDER: Section[] = ['comprehension', 'vocabulary', 'grammar'];

export interface PETReadingComprehensionPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'ready' | 'submitting' | 'finished';

interface RestoredState {
  title: string;
  topics: string[];
  text: string;
  questions: PETReadingClientQuestion[];
  framingText: string;
  results: PETReadingQuestionResult[] | null;
  correctCount: number;
}

function toClientQuestion(raw: Record<string, unknown>): PETReadingClientQuestion {
  const number = Number(raw.number);
  const section = raw.section as Section;
  if (raw.type === 'open') {
    return { number, section, type: 'open', question: String(raw.question ?? '') };
  }
  const options = raw.options as { A: string; B: string; C: string };
  return { number, section, type: 'mcq', question: String(raw.question ?? ''), options };
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let title = '';
  let topics: string[] = [];
  let text = '';
  let questions: PETReadingClientQuestion[] | null = null;
  let framingText = '';
  let results: PETReadingQuestionResult[] | null = null;
  let correctCount = 0;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'pet_reading_comprehension_plan') {
      title = String(cj.title ?? '');
      topics = Array.isArray(cj.topics) ? (cj.topics as string[]) : [];
      text = String(cj.text ?? '');
      const rawQuestions = Array.isArray(cj.questions) ? (cj.questions as Record<string, unknown>[]) : [];
      questions = rawQuestions.map(toClientQuestion);
      framingText = String(cj.framing_text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      results = (cj.question_results as PETReadingQuestionResult[]) ?? null;
      correctCount = Number(cj.score ?? 0);
    }
  }

  if (questions) return { title, topics, text, questions, framingText, results, correctCount };
  return null;
}

function SectionHeader({ section }: { section: Section }) {
  const meta = SECTION_META[section];
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black uppercase tracking-wide">
        {meta.title}
      </span>
      <span className="text-xs text-gray-400">{meta.subtitle}</span>
    </div>
  );
}

function QuestionCard({
  question,
  answer,
  onSelectMcq,
  onChangeOpen,
}: {
  question: PETReadingClientQuestion;
  answer: PETReadingAnswer | undefined;
  onSelectMcq: (number: number, value: 'A' | 'B' | 'C') => void;
  onChangeOpen: (number: number, value: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: question.number * 0.04 }}
      className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${ACCENT_RING}`}
    >
      <div className="px-4 pt-4 pb-2 flex items-start gap-2">
        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
          {question.number}
        </span>
        <p className="text-sm font-semibold text-gray-700 leading-snug">{question.question}</p>
      </div>

      {question.type === 'mcq' ? (
        <div className="px-4 pb-4 space-y-2">
          {(['A', 'B', 'C'] as const).map((key) => {
            const isSelected = answer?.type === 'mcq' && answer.value === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectMcq(question.number, key)}
                className={[
                  'w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors cursor-pointer',
                  isSelected
                    ? 'border-emerald-400 bg-emerald-50 text-gray-800'
                    : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-emerald-200 hover:bg-emerald-50/40',
                ].join(' ')}
              >
                <span
                  className={[
                    'shrink-0 w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center mt-0.5',
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-gray-300 bg-white text-gray-500',
                  ].join(' ')}
                >
                  {key}
                </span>
                <span className="leading-snug">{question.options[key]}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="px-4 pb-4">
          <input
            type="text"
            value={answer?.type === 'open' ? answer.value : ''}
            onChange={(e) => onChangeOpen(question.number, e.target.value)}
            placeholder="Type your answer…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white transition-colors"
          />
        </div>
      )}
    </motion.div>
  );
}

function ResultCard({ result, animate }: { result: PETReadingQuestionResult; animate: boolean }) {
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: result.number * 0.05 }}
      className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-4 pt-4 pb-2 flex items-start gap-2">
        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
          {result.number}
        </span>
        {result.is_correct ? (
          <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
        ) : (
          <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
        )}
      </div>

      {result.type === 'mcq' ? (
        <div className="px-4 pb-3 space-y-2">
          {(['A', 'B', 'C'] as const).map((key) => {
            const isChosen = result.chosen === key;
            const isCorrectOpt = key === result.answer;
            const showGreen = isCorrectOpt;
            const showRed = isChosen && !result.is_correct;
            return (
              <div
                key={key}
                className={[
                  'rounded-xl border px-3 py-2 text-sm',
                  showGreen ? 'border-green-300 bg-green-50' : '',
                  showRed ? 'border-red-300 bg-red-50' : '',
                  !showGreen && !showRed ? 'border-gray-100 bg-gray-50 opacity-60' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-600">{key}.</span>
                  <span className="text-xs text-gray-500">{result.feedback[key]}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 pb-3 space-y-2 text-sm">
          <p className="text-gray-700">
            <span className="font-semibold text-gray-500">Your answer: </span>
            <span className={result.is_correct ? 'text-green-700' : 'text-red-600'}>
              {result.chosen || '—'}
            </span>
          </p>
          {!result.is_correct && (
            <p className="text-gray-700">
              <span className="font-semibold text-gray-500">Accepted: </span>
              {result.accept.join(', ')}
            </p>
          )}
          <p className="text-xs text-gray-500 leading-relaxed">{result.feedback}</p>
        </div>
      )}
    </motion.div>
  );
}

/** PET Reading — Comprehensive Text practice component (one passage + 10 questions, no audio). */
export function PETReadingComprehensionPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: PETReadingComprehensionPracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [questions, setQuestions] = useState<PETReadingClientQuestion[]>([]);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, PETReadingAnswer>>({});
  const [results, setResults] = useState<PETReadingQuestionResult[]>([]);
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
          setTitle(restored.title);
          setTopics(restored.topics);
          setText(restored.text);
          setQuestions(restored.questions);
          setFramingText(restored.framingText);
          if (restored.results) {
            setResults(restored.results);
            setCorrectCount(restored.correctCount);
            setPhase('finished');
          } else {
            const { createSupabaseBrowser } = await import('@/lib/supabase/browser-client');
            const supabase = createSupabaseBrowser();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
            setPhase('ready');
          }
          return;
        }
      }

      if (initialSessionId) return;

      setIsNewSession(true);
      const result = await generatePETReadingComprehensionAction({ sessionId: initialSessionId });

      if ('error' in result) {
        setErrorMsg(result.error);
        return;
      }

      onSessionCreated?.(result.sessionId);
      setSessionId(result.sessionId);
      setUserId(result.userId);
      setTitle(result.title);
      setTopics(result.topics);
      setText(result.text);
      setQuestions(result.questions);
      setFramingText(result.framingText);
      setPhase('ready');
    }

    void init();
  }, []);

  function handleSelectMcq(number: number, value: 'A' | 'B' | 'C') {
    setAnswers((prev) => ({ ...prev, [number]: { type: 'mcq', value } }));
  }

  function handleChangeOpen(number: number, value: string) {
    setAnswers((prev) => ({ ...prev, [number]: { type: 'open', value } }));
  }

  async function handleSubmit() {
    if (!sessionId || !userId) return;
    setPhase('submitting');

    const result = await submitPETReadingComprehensionAction({ sessionId, userId, answers });

    if ('error' in result) {
      setErrorMsg(result.error);
      setPhase('ready');
      return;
    }

    setResults(result.question_results);
    setCorrectCount(result.correct_count);
    setPhase('finished');
    onSessionFinished?.();
  }

  function isAnswered(q: PETReadingClientQuestion): boolean {
    const a = answers[q.number];
    if (!a) return false;
    if (a.type === 'open') return a.value.trim().length > 0;
    return true;
  }

  const answeredCount = questions.filter(isAnswered).length;
  const allAnswered = answeredCount === questions.length && questions.length > 0;

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
        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <PETReadingIcon size={18} className="text-emerald-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">Reading — Comprehensive Text</p>
          <p className="text-xs text-gray-400">Reading · B1</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
          B1
        </span>
      </div>

      {phase === 'loading' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Preparing your reading…" />
        </div>
      )}

      {phase === 'submitting' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Checking your answers…" />
        </div>
      )}

      {phase === 'ready' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="flex items-start gap-2">
              <BobAvatar />
              <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed max-w-sm">
                {framingText}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 px-4 py-4 space-y-2">
              {title && <p className="text-sm font-black text-gray-800">{title}</p>}
              {topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {topics.map((topic) => (
                    <span
                      key={topic}
                      className="px-2 py-0.5 rounded-full bg-white text-emerald-700 text-[10px] font-semibold ring-1 ring-emerald-200"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line pt-1">{text}</p>
            </div>

            {SECTION_ORDER.map((section) => {
              const sectionQuestions = questions.filter((q) => q.section === section);
              if (sectionQuestions.length === 0) return null;
              return (
                <div key={section} className="space-y-3">
                  <SectionHeader section={section} />
                  {sectionQuestions.map((q) => (
                    <QuestionCard
                      key={q.number}
                      question={q}
                      answer={answers[q.number]}
                      onSelectMcq={handleSelectMcq}
                      onChangeOpen={handleChangeOpen}
                    />
                  ))}
                </div>
              );
            })}

            <div className="h-20" />
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
            <p className="text-xs text-gray-400 flex-1">
              {answeredCount} of {questions.length} answered
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Check answers
            </button>
          </div>
        </>
      )}

      {phase === 'finished' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 px-4 py-4">
            {title && <p className="text-sm font-black text-gray-800 mb-1">{title}</p>}
            <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">{text}</p>
          </div>

          {SECTION_ORDER.map((section) => {
            const sectionResults = results.filter((r) => r.section === section);
            if (sectionResults.length === 0) return null;
            return (
              <div key={section} className="space-y-3">
                <SectionHeader section={section} />
                {sectionResults.map((r) => (
                  <ResultCard key={r.number} result={r} animate={isNewSession} />
                ))}
              </div>
            );
          })}

          <div className="flex justify-center pt-2">
            <CelebrationCard
              score={correctCount}
              scoreMax={10}
              feedback="Great reading practice!"
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
