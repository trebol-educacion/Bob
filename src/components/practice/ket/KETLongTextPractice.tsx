'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { KETReadingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import {
  generateKETLongTextAction,
  submitKETLongTextAction,
  type LongTextExercise,
  type LongTextItemResult,
} from '@/actions/modes/ket-reading-part3';
import type { StoredMessage } from '@/actions/messages';

export interface KETLongTextPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';

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

/** KET Reading Part 3 — Long Text Comprehension practice component. */
export function KETLongTextPractice({
  onBack, sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished, onOpenDashboard,
}: KETLongTextPracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [exercise, setExercise] = useState<LongTextExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C' | null>>({});
  const [results, setResults] = useState<LongTextItemResult[]>([]);
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
      const result = await generateKETLongTextAction({ sessionId: initialSessionId });
      if ('error' in result) { setErrorMsg(result.error); return; }
      onSessionCreated?.(result.sessionId); setSessionId(result.sessionId); setUserId(result.userId);
      setExercise(result.exercise); setFramingText(result.framing_text); setPhase('ready');
    }
    void init();
  }, []);

  async function handleSubmit() {
    if (!sessionId || !userId || !exercise) return;
    setPhase('submitting');
    const result = await submitKETLongTextAction({ sessionId, userId, answers, items: exercise.items });
    if ('error' in result) { setErrorMsg(result.error); setPhase('ready'); return; }
    setResults(result.item_results); setCorrectCount(result.correct_count); setPhase('finished'); onSessionFinished?.();
  }

  const answeredCount = Object.values(answers).filter((v) => v !== null).length;
  const allAnswered = exercise ? answeredCount === exercise.items.length : false;

  if (errorMsg) return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
      <p className="text-red-500 font-semibold">{errorMsg}</p>
      <button type="button" onClick={onBack} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm">Back</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">←</button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)' }}><KETReadingIcon size={18} className="text-bob-brand" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">Read and Decide</p>
          <p className="text-xs text-gray-400">KET Reading · Part 3</p>
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
              <p className="px-4 py-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{exercise.text}</p>
            </motion.div>

            {exercise.items.map((item) => (
              <motion.div key={item.number} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: item.number * 0.05 }} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-2 flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)', color: 'var(--color-bob-brand)' }}>{item.number}</span>
                  <p className="text-sm font-semibold text-gray-800 leading-snug">{item.question}</p>
                </div>
                <div className="px-4 pb-4 space-y-2">
                  {(['A', 'B', 'C'] as const).map((k) => (
                    <button key={k} type="button" onClick={() => setAnswers((prev) => ({ ...prev, [item.number]: k }))}
                      className="flex items-center gap-3 w-full rounded-xl border p-2.5 text-left transition-colors cursor-pointer"
                      style={answers[item.number] === k ? { borderColor: 'color-mix(in oklab, var(--color-bob-brand) 50%, white)', background: 'color-mix(in oklab, var(--color-bob-brand) 10%, white)' } : { borderColor: '#f3f4f6', background: '#f9fafb' }}>
                      <span className="shrink-0 w-7 h-7 rounded-full border text-xs font-black flex items-center justify-center"
                        style={answers[item.number] === k ? { background: 'var(--color-bob-brand)', borderColor: 'var(--color-bob-brand)', color: 'white' } : { borderColor: '#d1d5db', background: 'white', color: '#6b7280' }}>
                        {k}
                      </span>
                      <span className="text-sm text-gray-700 leading-snug">{item.options[k]}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            ))}
            <div className="h-20" />
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
            <p className="text-xs text-gray-400 flex-1">{answeredCount} of {exercise.items.length} answered</p>
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
            <p className="px-4 py-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{exercise.text}</p>
          </div>

          {exercise.items.map((item) => {
            const r = results.find((r) => r.number === item.number);
            if (!r) return null;
            return (
              <motion.div key={item.number} initial={isNewSession ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: item.number * 0.05 }} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-2 flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)', color: 'var(--color-bob-brand)' }}>{item.number}</span>
                  <p className="text-sm font-semibold text-gray-800 leading-snug flex-1">{item.question}</p>
                  {r.is_correct ? <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" /> : <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />}
                </div>
                <div className="px-4 pb-4 space-y-2">
                  {(['A', 'B', 'C'] as const).map((k) => {
                    const isCorrect = k === r.correct_answer;
                    const isChosen = k === r.chosen;
                    return (
                      <div key={k} className={`flex items-center gap-3 rounded-xl border p-2.5 ${isCorrect ? 'border-green-300 bg-green-50' : isChosen ? 'border-red-300 bg-red-50' : 'border-gray-100 bg-gray-50 opacity-50'}`}>
                        <span className={`shrink-0 w-7 h-7 rounded-full border text-xs font-black flex items-center justify-center ${isCorrect ? 'border-green-500 bg-green-500 text-white' : isChosen ? 'border-red-400 bg-red-400 text-white' : 'border-gray-300 bg-white text-gray-400'}`}>{k}</span>
                        <span className={`text-sm leading-snug flex-1 ${isCorrect ? 'text-green-800' : isChosen ? 'text-red-700' : 'text-gray-400'}`}>{item.options[k]}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}

          <div className="flex justify-center pt-2">
            <CelebrationCard score={correctCount} scoreMax={exercise.items.length} feedback="Great reading practice!" onAction={onOpenDashboard} actionLabel="See my progress" animate={isNewSession} />
          </div>
        </div>
      )}
    </div>
  );
}
