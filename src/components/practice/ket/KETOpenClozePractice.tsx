'use client';

import React, { useEffect, useRef, useState } from 'react';
import { KETReadingIcon } from '@/components/icons/KETIcons';
import { ActivityHeader } from '@/components/activity/ActivityHeader';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
import { GapText, type GapReview } from '@/components/practice/gap-text';
import {
  startKETOpenClozeAction,
  submitKETOpenClozeAction,
  type KetOpenClozeExercise,
} from '@/actions/modes/ket-reading-part5';
import type { StoredMessage } from '@/actions/messages';
import type { OpenClozeGapResult } from '@/lib/ket/open-cloze-grading';
import { resolveActivityBoot } from '@/lib/activity/boot';
import { restoreExercise } from '@/lib/ket/restore-plan';

const ACCENT = '#469E7B';
const ACCENT_TINT = 'color-mix(in oklab, #469E7B 14%, white)';

export interface KETOpenClozePracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'ready' | 'submitting' | 'finished';

function tryRestore(messages: StoredMessage[]) {
  return restoreExercise<KetOpenClozeExercise, OpenClozeGapResult>(messages, 'ket_open_cloze_plan', 'gap_results');
}

function toReview(results: OpenClozeGapResult[]): Record<number, GapReview> {
  return Object.fromEntries(
    results.map((r) => [r.number, { isCorrect: r.is_correct, given: r.given || '—', expected: r.expected }]),
  );
}

/** @param props KETOpenClozePracticeProps */
export function KETOpenClozePractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETOpenClozePracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [exercise, setExercise] = useState<KetOpenClozeExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [results, setResults] = useState<OpenClozeGapResult[]>([]);
  const [loadError, setLoadError] = useState<{ code?: string | null; message?: string | null } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    async function init() {
      const boot = resolveActivityBoot({ initialMessages, sessionId: initialSessionId, tryRestore });
      if (boot.kind === 'restore') {
        setExercise(boot.data.exercise);
        setFramingText(boot.data.framingText);
        if (boot.data.results) {
          setResults(boot.data.results);
          setPhase('finished');
        } else {
          setPhase('ready');
        }
        return;
      }
      if (boot.kind === 'restore-failed') {
        setLoadError({ message: 'Could not restore session. Please start a new one.' });
        return;
      }
      setIsNewSession(true);
      const started = await startKETOpenClozeAction();
      if (!started.ok) {
        setLoadError({ code: started.code });
        return;
      }
      setExercise(started.data.exercise);
      setFramingText(started.data.framing_text);
      setPhase('ready');
    }
    void init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    if (!exercise) return;
    setPhase('submitting');
    setSubmitError(null);
    const result = await submitKETOpenClozeAction({ sessionId, framing_text: framingText, exercise, answers });
    if (!result.ok) {
      setSubmitError('We could not check your answers. Please try again.');
      setPhase('ready');
      return;
    }
    setResults(result.data.gap_results);
    setPhase('finished');
    if (!sessionId) onSessionCreated?.(result.data.sessionId);
    setSessionId(result.data.sessionId);
    onSessionFinished?.();
  }

  if (loadError) return <ActivityLoadError code={loadError.code} message={loadError.message} onBack={onBack} />;

  const total = exercise?.gap_numbers.length ?? 0;
  const answered = exercise ? exercise.gap_numbers.filter((n) => (answers[n] ?? '').trim() !== '').length : 0;
  const correct = results.filter((r) => r.is_correct).length;

  return (
    <div className="flex flex-col h-full relative">
      <ActivityHeader
        title="Open Cloze"
        subtitle="Reading · Part 5"
        badge="Part 5"
        icon={<KETReadingIcon size={18} />}
        iconStyle={{ background: ACCENT_TINT, color: ACCENT }}
        onBack={onBack}
      />

      {(phase === 'loading' || phase === 'submitting') && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={phase === 'loading' ? 'Preparing exercise…' : 'Checking your answers…'} />
        </div>
      )}

      {(phase === 'ready' || phase === 'finished') && exercise && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
            {framingText && <p className="text-sm text-gray-600 leading-relaxed">{framingText}</p>}
            <div className="rounded-3xl border border-gray-100 shadow-sm px-5 py-4 bg-white space-y-3">
              <p className="text-base font-bold text-gray-800">{exercise.title}</p>
              <div className="text-[15px] text-gray-700 leading-loose">
                <GapText
                  text={exercise.text}
                  mode="input"
                  values={answers}
                  onChange={(number, value) => setAnswers((prev) => ({ ...prev, [number]: value }))}
                  review={phase === 'finished' ? toReview(results) : undefined}
                />
              </div>
            </div>
            {phase === 'finished' && (
              <div className="flex justify-center pt-2 pb-6">
                <CelebrationCard
                  score={correct}
                  scoreMax={total}
                  onAction={onOpenDashboard}
                  actionLabel="See my progress"
                  animate={isNewSession}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'ready' && exercise && (
        <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <p className="text-xs text-gray-400 flex-1">
              {submitError ? <span role="alert" className="text-red-600">{submitError}</span> : `${answered} / ${total} answered`}
            </p>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={answered === 0}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: ACCENT }}
            >
              Submit answers
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
