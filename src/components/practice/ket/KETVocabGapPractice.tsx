'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { KETReadingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import {
  generateKETVocabGapAction,
  submitKETVocabGapAction,
  type VocabGapExercise,
  type VocabGapItemResult,
  type VocabGapItem,
} from '@/actions/modes/ket-reading-part4';
import type { StoredMessage } from '@/actions/messages';

export interface KETVocabGapPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';

function tryRestore(messages: StoredMessage[]): { exercise: VocabGapExercise; framingText: string; results: VocabGapItemResult[] | null; correctCount: number } | null {
  let exercise: VocabGapExercise | null = null;
  let framingText = '';
  let results: VocabGapItemResult[] | null = null;
  let correctCount = 0;
  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;
    if (msg.role === 'bob' && cj.kind === 'reading_vocab_gap_plan') { exercise = cj.exercise as VocabGapExercise; framingText = String(cj.framing_text ?? ''); }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) { results = cj.item_results as VocabGapItemResult[]; correctCount = Number(cj.score ?? 0); }
  }
  return exercise ? { exercise, framingText, results, correctCount } : null;
}

/** Renders the text with inline gap buttons replacing [N] markers. */
function GappedText({
  text,
  items,
  answers,
  onSelect,
  disabled,
  results,
}: {
  text: string;
  items: VocabGapItem[];
  answers: Record<number, 'A' | 'B' | 'C' | null>;
  onSelect?: (n: number, k: 'A' | 'B' | 'C') => void;
  disabled: boolean;
  results?: VocabGapItemResult[];
}) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="text-sm text-gray-700 leading-relaxed">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (!match) return <span key={i}>{part}</span>;
        const n = parseInt(match[1], 10);
        const item = items.find((it) => it.number === n);
        if (!item) return <span key={i} className="text-red-400">[?]</span>;

        if (results) {
          const r = results.find((r) => r.number === n);
          const chosen = r?.chosen;
          const correct = r?.correct_answer;
          const isCorrect = r?.is_correct;
          const word = chosen ? item.options[chosen] : '—';
          return (
            <span key={i} className={`inline-flex items-center gap-0.5 mx-0.5 px-2 py-0.5 rounded-lg text-xs font-bold border ${isCorrect ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-700'}`}>
              {isCorrect ? word : <><span className="line-through">{word}</span><span className="mx-1 text-gray-400">→</span><span className="text-green-700">{correct ? item.options[correct] : '?'}</span></>}
              {isCorrect ? <CheckCircle size={10} className="text-green-500" /> : <XCircle size={10} className="text-red-400" />}
            </span>
          );
        }

        const selected = answers[n];
        const word = selected ? item.options[selected] : null;
        return (
          <span key={i} className="inline-block mx-0.5 align-middle">
            <button type="button" disabled={disabled}
              className={`px-2 py-0.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${word ? '' : 'border-dashed border-gray-300 text-gray-400 bg-gray-50'}`}
              style={word ? { background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)', borderColor: 'color-mix(in oklab, var(--color-bob-brand) 40%, white)', color: 'var(--color-bob-brand)' } : undefined}
              onClick={() => {
                if (!onSelect) return;
                const current = answers[n];
                const opts = ['A', 'B', 'C'] as const;
                const next = current ? opts[(opts.indexOf(current) + 1) % 3] : 'A';
                onSelect(n, next);
              }}
            >
              {word ?? `___${n}___`}
            </button>
          </span>
        );
      })}
    </p>
  );
}

/** KET Reading Part 4 — Vocabulary Gap-Fill practice component. */
export function KETVocabGapPractice({
  onBack, sessionId: initialSessionId, initialMessages, onSessionCreated, onSessionFinished, onOpenDashboard,
}: KETVocabGapPracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [exercise, setExercise] = useState<VocabGapExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C' | null>>({});
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
          setExercise(r.exercise); setFramingText(r.framingText);
          if (r.results) { setResults(r.results); setCorrectCount(r.correctCount); setPhase('finished'); }
          else { const { createSupabaseBrowser } = await import('@/lib/supabase/browser-client'); const { data: { user } } = await createSupabaseBrowser().auth.getUser(); if (user) setUserId(user.id); setPhase('ready'); }
          return;
        }
      }
      if (initialSessionId) return;
      setIsNewSession(true); setPhase('generating');
      const result = await generateKETVocabGapAction({ sessionId: initialSessionId });
      if ('error' in result) { setErrorMsg(result.error); return; }
      onSessionCreated?.(result.sessionId); setSessionId(result.sessionId); setUserId(result.userId);
      setExercise(result.exercise); setFramingText(result.framing_text); setPhase('ready');
    }
    void init();
  }, []);

  async function handleSubmit() {
    if (!sessionId || !userId || !exercise) return;
    setPhase('submitting');
    const result = await submitKETVocabGapAction({ sessionId, userId, answers, items: exercise.items });
    if ('error' in result) { setErrorMsg(result.error); setPhase('ready'); return; }
    setResults(result.item_results); setCorrectCount(result.correct_count); setPhase('finished'); onSessionFinished?.();
  }

  const answeredCount = Object.values(answers).filter((v) => v !== null).length;
  const allAnswered = exercise ? answeredCount === exercise.items.length : false;

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
          <p className="text-sm font-bold text-gray-800 truncate">Choose the Word</p>
          <p className="text-xs text-gray-400">Reading · Part 4</p>
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
              <div className="px-4 py-4">
                <GappedText text={exercise.text} items={exercise.items} answers={answers} onSelect={(n, k) => setAnswers((prev) => ({ ...prev, [n]: k }))} disabled={false} />
              </div>
            </motion.div>

            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)' }}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Options</p>
              </div>
              <div className="divide-y divide-gray-50">
                {exercise.items.map((item) => (
                  <div key={item.number} className="px-4 py-3 flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)', color: 'var(--color-bob-brand)' }}>{item.number}</span>
                    <div className="flex gap-2 flex-1">
                      {(['A', 'B', 'C'] as const).map((k) => (
                        <button key={k} type="button" onClick={() => setAnswers((prev) => ({ ...prev, [item.number]: k }))}
                          className="flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer"
                          style={answers[item.number] === k ? { background: 'var(--color-bob-brand)', borderColor: 'var(--color-bob-brand)', color: 'white' } : { borderColor: '#e5e7eb', background: '#f9fafb', color: '#374151' }}>
                          {item.options[k]}
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
            <p className="text-xs text-gray-400 flex-1">{answeredCount} of {exercise.items.length} answered</p>
            <button type="button" onClick={handleSubmit} disabled={!allAnswered} className="px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer" style={{ background: 'var(--color-bob-brand)' }}>Check answers</button>
          </div>
        </>
      )}

      {phase === 'finished' && exercise && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <motion.div initial={isNewSession ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)' }}>
              <p className="text-sm font-bold text-gray-800">{exercise.title}</p>
            </div>
            <div className="px-4 py-4">
              <GappedText text={exercise.text} items={exercise.items} answers={{}} disabled={true} results={results} />
            </div>
          </motion.div>

          <div className="flex justify-center pt-2">
            <CelebrationCard score={correctCount} scoreMax={exercise.items.length} feedback="Great reading practice!" onAction={onOpenDashboard} actionLabel="See my progress" animate={isNewSession} />
          </div>
        </div>
      )}
    </div>
  );
}
