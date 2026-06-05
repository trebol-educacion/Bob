'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { KETReadingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import {
  generateKETMatchQuestionAction,
  submitKETMatchQuestionAction,
  type MatchExercise,
  type QuestionResult,
} from '@/actions/modes/ket-reading-part2';
import type { StoredMessage } from '@/actions/messages';

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

/** KET Reading Part 2 — Multiple Matching practice component. */
export function KETMatchQuestionPractice({
  onBack, sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished, onOpenDashboard,
}: KETMatchQuestionPracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [exercise, setExercise] = useState<MatchExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C' | null>>({});
  const [results, setResults] = useState<QuestionResult[]>([]);
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
      const result = await generateKETMatchQuestionAction({ sessionId: initialSessionId });
      if ('error' in result) { setErrorMsg(result.error); return; }
      onSessionCreated?.(result.sessionId); setSessionId(result.sessionId); setUserId(result.userId);
      setExercise(result.exercise); setFramingText(result.framing_text); setPhase('ready');
    }
    void init();
  }, []);

  async function handleSubmit() {
    if (!sessionId || !userId || !exercise) return;
    setPhase('submitting');
    const result = await submitKETMatchQuestionAction({ sessionId, userId, answers, questions: exercise.questions });
    if ('error' in result) { setErrorMsg(result.error); setPhase('ready'); return; }
    setResults(result.question_results); setCorrectCount(result.correct_count); setPhase('finished'); onSessionFinished?.();
  }

  const answeredCount = Object.values(answers).filter((v) => v !== null).length;
  const allAnswered = exercise ? answeredCount === exercise.questions.length : false;

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
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)' }}>
          <KETReadingIcon size={18} className="text-bob-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">Match the Question</p>
          <p className="text-xs text-gray-400">Reading · Part 2</p>
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

            <div className="space-y-3">
              {exercise.texts.map((t) => (
                <motion.div key={t.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)' }}>
                    <span className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center text-white shrink-0" style={{ background: 'var(--color-bob-brand)' }}>{t.label}</span>
                    <span className="text-xs font-bold text-gray-700">{t.author}</span>
                  </div>
                  <p className="px-4 py-3 text-sm text-gray-700 leading-relaxed">{t.text}</p>
                </motion.div>
              ))}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)' }}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Questions</p>
              </div>
              <div className="divide-y divide-gray-50">
                {exercise.questions.map((q) => (
                  <div key={q.number} className="px-4 py-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)', color: 'var(--color-bob-brand)' }}>{q.number}</span>
                      <p className="text-sm text-gray-700 leading-snug flex-1">{q.text}</p>
                    </div>
                    <div className="flex gap-2 pl-7">
                      {(['A', 'B', 'C'] as const).map((k) => (
                        <button key={k} type="button" onClick={() => setAnswers((prev) => ({ ...prev, [q.number]: k }))}
                          className="w-9 h-9 rounded-full text-sm font-black border transition-all cursor-pointer"
                          style={answers[q.number] === k ? { background: 'var(--color-bob-brand)', borderColor: 'var(--color-bob-brand)', color: 'white' } : { borderColor: '#e5e7eb', background: '#f9fafb', color: '#6b7280' }}>
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-20" />
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
            <p className="text-xs text-gray-400 flex-1">{answeredCount} of {exercise.questions.length} answered</p>
            <button type="button" onClick={handleSubmit} disabled={!allAnswered} className="px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer" style={{ background: 'var(--color-bob-brand)' }}>Check answers</button>
          </div>
        </>
      )}

      {phase === 'finished' && exercise && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="space-y-3">
            {exercise.texts.map((t) => (
              <div key={t.label} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)' }}>
                  <span className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center text-white shrink-0" style={{ background: 'var(--color-bob-brand)' }}>{t.label}</span>
                  <span className="text-xs font-bold text-gray-700">{t.author}</span>
                </div>
                <p className="px-4 py-3 text-sm text-gray-700 leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {results.map((r) => {
                const q = exercise.questions.find((q) => q.number === r.number);
                return (
                  <motion.div key={r.number} initial={isNewSession ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: r.number * 0.05 }} className="px-4 py-3 flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)', color: 'var(--color-bob-brand)' }}>{r.number}</span>
                    <p className="text-sm text-gray-700 leading-snug flex-1">{q?.text}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.is_correct ? (
                        <span className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center bg-green-100 text-green-700">{r.correct_answer}</span>
                      ) : (
                        <>
                          <span className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center bg-red-100 text-red-500 line-through">{r.chosen ?? '—'}</span>
                          <span className="text-gray-400 text-xs">→</span>
                          <span className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center bg-green-100 text-green-700">{r.correct_answer}</span>
                        </>
                      )}
                      {r.is_correct ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-400" />}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <CelebrationCard score={correctCount} scoreMax={exercise.questions.length} feedback="Great reading practice!" onAction={onOpenDashboard} actionLabel="See my progress" animate={isNewSession} />
          </div>
        </div>
      )}
    </div>
  );
}
