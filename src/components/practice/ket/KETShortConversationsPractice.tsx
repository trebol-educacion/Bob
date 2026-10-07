'use client';

import React, { useEffect, useRef, useState } from 'react';
import { KETListeningIcon } from '@/components/icons/KETIcons';
import { ActivityHeader } from '@/components/activity/ActivityHeader';
import { AudioClipPlayer } from '@/components/activity/AudioClipPlayer';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
import { ChoiceOptions } from './listening/ChoiceOptions';
import {
  startKETShortConversationsAction,
  submitKETShortConversationsAction,
  type KetShortConversationsExercise,
} from '@/actions/modes/ket-listening-part4';
import type { StoredMessage } from '@/actions/messages';
import type { KeyedResult } from '@/lib/ket/listening-grading';
import { resolveActivityBoot } from '@/lib/activity/boot';
import { restoreExercise } from '@/lib/ket/restore-plan';

const ACCENT = '#F8AC37';
const ACCENT_TINT = 'color-mix(in oklab, #F8AC37 14%, white)';
const MAX_PLAYS = 2;

export interface KETShortConversationsPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'ready' | 'submitting' | 'finished';

function tryRestore(messages: StoredMessage[]) {
  return restoreExercise<KetShortConversationsExercise, KeyedResult>(messages, 'ket_short_conversations_plan', 'item_results');
}

/** @param props KETShortConversationsPracticeProps */
export function KETShortConversationsPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETShortConversationsPracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [exercise, setExercise] = useState<KetShortConversationsExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [results, setResults] = useState<KeyedResult[]>([]);
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
          setAnswers(Object.fromEntries(boot.data.results.map((r) => [r.number, r.chosen ?? ''])));
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
      const started = await startKETShortConversationsAction();
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
    const result = await submitKETShortConversationsAction({ sessionId, framing_text: framingText, exercise, answers });
    if (!result.ok) {
      setSubmitError('We could not check your answers. Please try again.');
      setPhase('ready');
      return;
    }
    setResults(result.data.item_results);
    setPhase('finished');
    if (!sessionId) onSessionCreated?.(result.data.sessionId);
    setSessionId(result.data.sessionId);
    onSessionFinished?.();
  }

  if (loadError) return <ActivityLoadError code={loadError.code} message={loadError.message} onBack={onBack} />;

  const total = exercise?.items.length ?? 0;
  const answered = exercise ? exercise.items.filter((item) => answers[item.number]).length : 0;
  const resultOf = (number: number) => results.find((r) => r.number === number);

  return (
    <div className="flex flex-col h-full relative">
      <ActivityHeader
        title="Short Conversations"
        subtitle="Listening · Part 4"
        badge="Part 4"
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
            {exercise.items.map((item) => {
              const result = resultOf(item.number);
              return (
                <section key={item.number} className="rounded-3xl border border-gray-100 shadow-sm bg-white px-4 py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center" style={{ background: ACCENT_TINT, color: ACCENT }}>
                      {item.number}
                    </span>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{item.context}</p>
                  </div>
                  <AudioClipPlayer src={item.audio_url} maxPlays={phase === 'finished' ? undefined : MAX_PLAYS} />
                  <p className="text-sm font-bold text-gray-800">{item.question}</p>
                  <ChoiceOptions
                    options={item.options}
                    chosen={answers[item.number] ?? null}
                    correctKey={result?.correct_key}
                    accent={ACCENT}
                    onChoose={phase === 'ready' ? (key) => setAnswers((prev) => ({ ...prev, [item.number]: key })) : undefined}
                  />
                  {result?.transcript && (
                    <details className="text-xs text-gray-500">
                      <summary className="cursor-pointer font-semibold">See conversation transcript</summary>
                      <p className="mt-2 whitespace-pre-line leading-relaxed">{result.transcript}</p>
                    </details>
                  )}
                </section>
              );
            })}
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
