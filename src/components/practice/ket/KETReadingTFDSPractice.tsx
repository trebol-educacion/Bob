'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { KETReadingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import {
  generateKETReadingTFDSAction,
  submitKETReadingTFDSAction,
  type Verdict,
  type ReadingTFDSExercise,
  type ReadingStatementResult,
} from '@/actions/modes/ket-reading-part5';
import type { StoredMessage } from '@/actions/messages';

export interface KETReadingTFDSPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';

const VERDICTS: { value: Verdict; label: string }[] = [
  { value: 'T', label: 'True' },
  { value: 'F', label: 'False' },
  { value: 'DS', label: "DS" },
];

const VERDICT_COLORS: Record<Verdict, { bg: string; text: string; border: string }> = {
  T:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-300' },
  F:  { bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-300'   },
  DS: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-300' },
};

const VERDICT_LABELS: Record<Verdict, string> = { T: 'True', F: 'False', DS: "Doesn't Say" };

function tryRestore(messages: StoredMessage[]): { exercise: ReadingTFDSExercise; framingText: string; results: ReadingStatementResult[] | null; correctCount: number } | null {
  let exercise: ReadingTFDSExercise | null = null;
  let framingText = '';
  let results: ReadingStatementResult[] | null = null;
  let correctCount = 0;
  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;
    if (msg.role === 'bob' && cj.kind === 'reading_tfds_plan') { exercise = cj.exercise as ReadingTFDSExercise; framingText = String(cj.framing_text ?? ''); }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) { results = cj.statement_results as ReadingStatementResult[]; correctCount = Number(cj.score ?? 0); }
  }
  return exercise ? { exercise, framingText, results, correctCount } : null;
}

/** KET Reading Part 5 — True, False or Doesn't Say practice component. */
export function KETReadingTFDSPractice({
  onBack, sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished, onOpenDashboard,
}: KETReadingTFDSPracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [exercise, setExercise] = useState<ReadingTFDSExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, Verdict | null>>({});
  const [results, setResults] = useState<ReadingStatementResult[]>([]);
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
          setExercise(r.exercise); setFramingText(r.framingText);
          if (r.results) { setResults(r.results); setCorrectCount(r.correctCount); setPhase('finished'); }
          else { const { createSupabaseBrowser } = await import('@/lib/supabase/browser-client'); const { data: { user } } = await createSupabaseBrowser().auth.getUser(); if (user) setUserId(user.id); setPhase('ready'); }
          return;
        }
      }
      if (initialSessionId) return;
      setIsNewSession(true); setPhase('generating');
      const result = await generateKETReadingTFDSAction({ sessionId: initialSessionId });
      if ('error' in result) { setErrorMsg(result.error); return; }
      onSessionCreated?.(result.sessionId); setSessionId(result.sessionId); setUserId(result.userId);
      setExercise(result.exercise); setFramingText(result.framing_text); setPhase('ready');
    }
    void init();
  }, []);

  async function handleSubmit() {
    if (!sessionId || !userId || !exercise) return;
    setPhase('submitting');
    const result = await submitKETReadingTFDSAction({ sessionId, userId, answers, statements: exercise.statements });
    if ('error' in result) { setErrorMsg(result.error); setPhase('ready'); return; }
    setResults(result.statement_results); setCorrectCount(result.correct_count); setPhase('finished'); onSessionFinished?.();
  }

  const answeredCount = Object.values(answers).filter((v) => v !== null).length;
  const allAnswered = exercise ? answeredCount === exercise.statements.length : false;

  if (errorMsg) return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
      <p className="text-red-500 font-semibold">{errorMsg}</p>
      <button type="button" onClick={onBack} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 text-sm">Back</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">←</button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)' }}><KETReadingIcon size={18} className="text-bob-brand" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">True, False or Doesn't Say</p>
          <p className="text-xs text-gray-400">Reading · Part 5</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)', color: 'var(--color-bob-brand)' }}>A2</span>
      </div>

      {(phase === 'loading' || phase === 'generating') && <div className="flex-1 flex flex-col min-h-0"><BobMascotLoader message="Preparing exercise…" /></div>}
      {phase === 'submitting' && <div className="flex-1 flex flex-col min-h-0"><BobMascotLoader message="Checking your answers…" /></div>}

      {phase === 'ready' && exercise && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="flex items-start gap-2">
              <BobAvatar />
              <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed max-w-sm">{framingText}</div>
            </div>

            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)' }}>
                <p className="text-sm font-bold text-gray-800">{exercise.title}</p>
              </div>
              <p className="px-4 py-4 text-sm text-gray-700 leading-relaxed">{exercise.text}</p>
            </motion.div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
              <p className="text-xs text-amber-800 leading-snug"><span className="font-bold">DS = Doesn't Say</span> — the text doesn't mention this topic at all.</p>
            </div>

            {exercise.statements.map((s) => (
              <motion.div key={s.number} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: s.number * 0.05 }} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-3 flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)', color: 'var(--color-bob-brand)' }}>{s.number}</span>
                  <p className="text-sm text-gray-800 leading-snug flex-1">{s.text}</p>
                </div>
                <div className="px-4 pb-4 flex gap-2">
                  {VERDICTS.map((v) => (
                    <button key={v.value} type="button" onClick={() => setAnswers((prev) => ({ ...prev, [s.number]: v.value }))}
                      className="flex-1 py-2 rounded-xl border text-sm font-bold transition-all cursor-pointer"
                      style={answers[s.number] === v.value ? { background: 'var(--color-bob-brand)', borderColor: 'var(--color-bob-brand)', color: 'white' } : { borderColor: '#e5e7eb', background: '#f9fafb', color: '#6b7280' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            ))}
            <div className="h-20" />
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
            <p className="text-xs text-gray-400 flex-1">{answeredCount} of {exercise.statements.length} answered</p>
            <button type="button" onClick={handleSubmit} disabled={!allAnswered} className="px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer" style={{ background: 'var(--color-bob-brand)' }}>Check answers</button>
          </div>
        </>
      )}

      {phase === 'finished' && exercise && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)' }}>
              <p className="text-sm font-bold text-gray-800">{exercise.title}</p>
            </div>
            <p className="px-4 py-4 text-sm text-gray-700 leading-relaxed">{exercise.text}</p>
          </div>

          {results.map((r) => {
            const correctColors = VERDICT_COLORS[r.correct_verdict];
            const chosenColors = r.chosen ? VERDICT_COLORS[r.chosen] : null;
            return (
              <motion.div key={r.number} initial={isNewSession ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: r.number * 0.05 }} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-2 flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)', color: 'var(--color-bob-brand)' }}>{r.number}</span>
                  <p className="text-sm text-gray-800 leading-snug flex-1">{r.text}</p>
                  {r.is_correct ? <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" /> : <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />}
                </div>
                <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
                  {r.is_correct ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${correctColors.bg} ${correctColors.text} ${correctColors.border}`}>{VERDICT_LABELS[r.correct_verdict]}</span>
                  ) : (
                    <>
                      {chosenColors && r.chosen && <span className="px-3 py-1 rounded-full text-xs font-bold border border-red-200 bg-red-50 text-red-500 line-through">{VERDICT_LABELS[r.chosen]}</span>}
                      {!r.chosen && <span className="px-3 py-1 rounded-full text-xs font-bold border border-gray-200 bg-gray-50 text-gray-400 italic">No answer</span>}
                      <span className="text-xs text-gray-400">→</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${correctColors.bg} ${correctColors.text} ${correctColors.border}`}>{VERDICT_LABELS[r.correct_verdict]}</span>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}

          <div className="flex justify-center pt-2">
            <CelebrationCard score={correctCount} scoreMax={exercise.statements.length} feedback="Great reading practice!" onAction={onOpenDashboard} actionLabel="See my progress" animate={isNewSession} />
          </div>
        </div>
      )}
    </div>
  );
}
