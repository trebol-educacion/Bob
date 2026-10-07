'use client';

import React, { useEffect, useRef, useState } from 'react';
import { KETListeningIcon } from '@/components/icons/KETIcons';
import { ActivityHeader } from '@/components/activity/ActivityHeader';
import { AudioClipPlayer } from '@/components/activity/AudioClipPlayer';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
import { MatchingBoard } from '@/components/practice/matching/MatchingBoard';
import type { MatchingReview } from '@/components/practice/matching/types';
import {
  startKETListenMatchAction,
  submitKETListenMatchAction,
  type KetListenMatchExercise,
} from '@/actions/modes/ket-listening-part5';
import type { StoredMessage } from '@/actions/messages';
import type { KeyedResult } from '@/lib/ket/listening-grading';
import { resolveActivityBoot } from '@/lib/activity/boot';
import { restoreExercise } from '@/lib/ket/restore-plan';

const ACCENT = '#F8AC37';
const ACCENT_TINT = 'color-mix(in oklab, #F8AC37 14%, white)';
const MAX_PLAYS = 2;

export interface KETListenMatchPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'ready' | 'submitting' | 'finished';

function finalTranscript(messages: StoredMessage[]): string {
  const final = messages.find((m) => m.msg_type === 'evaluation' && (m.content_json as { is_final?: boolean } | null)?.is_final);
  const transcript = (final?.content_json as { transcript?: unknown } | null)?.transcript;
  return typeof transcript === 'string' ? transcript : '';
}

function tryRestore(messages: StoredMessage[]) {
  const restored = restoreExercise<KetListenMatchExercise, KeyedResult>(messages, 'ket_listen_match_plan', 'person_results');
  return restored ? { ...restored, transcript: finalTranscript(messages) } : null;
}

function toReview(results: KeyedResult[]): Record<string, MatchingReview> {
  return Object.fromEntries(results.map((r) => [String(r.number), { isCorrect: r.is_correct, correctKey: r.correct_key }]));
}

/** @param props KETListenMatchPracticeProps */
export function KETListenMatchPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETListenMatchPracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [exercise, setExercise] = useState<KetListenMatchExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<KeyedResult[]>([]);
  const [transcript, setTranscript] = useState('');
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
          setAnswers(Object.fromEntries(boot.data.results.map((r) => [String(r.number), r.chosen ?? ''])));
          setTranscript(boot.data.transcript);
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
      const started = await startKETListenMatchAction();
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
    const numericAnswers = Object.fromEntries(Object.entries(answers).map(([number, key]) => [Number(number), key]));
    const result = await submitKETListenMatchAction({ sessionId, framing_text: framingText, exercise, answers: numericAnswers });
    if (!result.ok) {
      setSubmitError('We could not check your answers. Please try again.');
      setPhase('ready');
      return;
    }
    setResults(result.data.person_results);
    setTranscript(result.data.transcript);
    setPhase('finished');
    if (!sessionId) onSessionCreated?.(result.data.sessionId);
    setSessionId(result.data.sessionId);
    onSessionFinished?.();
  }

  if (loadError) return <ActivityLoadError code={loadError.code} message={loadError.message} onBack={onBack} />;

  const total = exercise?.people.length ?? 0;
  const answered = Object.values(answers).filter(Boolean).length;

  return (
    <div className="flex flex-col h-full relative">
      <ActivityHeader
        title="Listen and Match"
        subtitle="Listening · Part 5"
        badge="Part 5"
        icon={<KETListeningIcon size={18} />}
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
            <section className="rounded-3xl border border-gray-100 shadow-sm bg-white px-4 py-4 space-y-3">
              <p className="text-sm font-bold text-gray-800">{exercise.instruction}</p>
              <AudioClipPlayer src={exercise.audio_url} maxPlays={phase === 'finished' ? undefined : MAX_PLAYS} />
            </section>
            <MatchingBoard
              choices={exercise.options.map((option) => ({ key: option.key, label: option.text }))}
              questions={exercise.people.map((person) => ({ id: String(person.number), number: person.number, text: person.name }))}
              answers={answers}
              onAnswer={phase === 'ready' ? (id, key) => setAnswers((prev) => ({ ...prev, [id]: key })) : undefined}
              review={phase === 'finished' ? toReview(results) : undefined}
              allowRepeatOptions={false}
            />
            {phase === 'finished' && transcript && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer font-semibold">See conversation transcript</summary>
                <p className="mt-2 whitespace-pre-line leading-relaxed">{transcript}</p>
              </details>
            )}
            {phase === 'finished' && (
              <div className="flex justify-center pt-2 pb-6">
                <CelebrationCard
                  score={results.filter((r) => r.is_correct).length}
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
