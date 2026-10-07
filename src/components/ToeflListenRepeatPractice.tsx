'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Headphones, Mic, RotateCcw, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import { useCountdown } from '@/hooks/useCountdown';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { blobToBase64 } from '@/lib/audio';
import { useTTS } from '@/hooks/useTTS';
import {
  generateToeflRepeatSessionAction,
  submitRepetitionAction,
  finishToeflRepeatAction,
} from '@/actions/modes/toefl_repeat';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
import { RepeatSummary } from '@/components/toefl/RepeatSummary';
import { restoreRepeat, type ToeflRepeatItem } from '@/lib/toefl/repeat';
import { resolveActivityBoot } from '@/lib/activity/boot';
import type { ActivityRenderProps } from '@/lib/routing';
import type { RepetitionObjectiveFeedback } from '@/lib/types/practice';
import { ChatShell } from '@/components/ChatShell';
import { MessageBubble, InfoCard } from '@/components/chat';

type Phase =
  | 'loading'
  | 'play'
  | 'ready'
  | 'record'
  | 'evaluating'
  | 'result'
  | 'finished';

interface ItemResult {
  item: ToeflRepeatItem;
  evaluation: RepetitionObjectiveFeedback;
}

const RECORD_SECONDS = 10;

function replaceAt(list: ItemResult[], index: number, value: ItemResult): ItemResult[] {
  const next = [...list];
  next[index] = value;
  return next;
}

function emptyEvaluation(text: string): RepetitionObjectiveFeedback {
  return { kind: 'repetition_objective', exact_repetition: false, missing_words: [], extra_words: [], transcribed_text: '', original_text: text };
}

/** Main component for the TOEFL Listen & Repeat practice mode. */
export function ToeflListenRepeatPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
}: ActivityRenderProps) {
  const t = useTranslations('toefl');
  const [boot] = useState(() =>
    resolveActivityBoot({ initialMessages, sessionId: initialSessionId, tryRestore: restoreRepeat }),
  );
  const restored = boot.kind === 'restore' ? boot.data : null;
  const [phase, setPhase] = useState<Phase>(restored?.finished ? 'finished' : 'loading');
  const [items, setItems] = useState<ToeflRepeatItem[]>(restored?.items ?? []);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
  const bankGroupIdRef = useRef<string | undefined>(undefined);
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (!restored || restored.finished) return 0;
    const firstOpen = restored.evaluations.findIndex((evaluation) => evaluation === null);
    return firstOpen === -1 ? 0 : firstOpen;
  });
  const [results, setResults] = useState<ItemResult[]>(() =>
    restored
      ? restored.items.map((item, index) => ({ item, evaluation: restored.evaluations[index] ?? emptyEvaluation(item.text) }))
      : [],
  );
  const [loadKey, setLoadKey] = useState(0);
  const restoredRef = useRef(restored);
  const loadErrorText = t('listenRepeat.loadError');
  const [currentEvaluation, setCurrentEvaluation] = useState<RepetitionObjectiveFeedback | null>(null);
  const [error, setError] = useState<string | null>(boot.kind === 'restore-failed' ? t('listenRepeat.loadError') : null);

  const { playUrl: playAudioUrl, stop: stopAudio } = useTTS();
  const recordedBlobRef = useRef<Blob | null>(null);
  const autoRecordStartedRef = useRef(false);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null);

  const countdown = useCountdown({
    seconds: RECORD_SECONDS,
    onComplete: () => {
      stopRecording();
    },
  });

  const { startRecording, stopRecording } = useAudioRecorder({
    onRecorded: (blob) => {
      recordedBlobRef.current = blob;
      setPhase('evaluating');
    },
    onError: (err) => {
      console.error('Recording error:', err);
      setError(t('common.micError'));
    },
  });

  useEffect(() => {
    const resumed = restoredRef.current;
    if (boot.kind === 'restore-failed' || resumed?.finished) return;
    let cancelled = false;

    async function load() {
      try {
        if (resumed) {
          setItems(resumed.items);
          setPhase('play');
          return;
        }
        const session = await generateToeflRepeatSessionAction();
        if (cancelled) return;
        if (!session.ok) {
          setLoadErrorCode(session.code);
          return;
        }
        bankGroupIdRef.current = session.data.bankGroupId;
        setItems(session.data.items);
        setPhase('play');
      } catch (err) {
        if (!cancelled) {
          console.error('Load error:', err);
          setError(loadErrorText);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [boot.kind, loadKey, loadErrorText]);

  useEffect(() => {
    if (phase !== 'play') return;
    const audioUrl = items[currentIndex]?.audio_url;
    if (!audioUrl) {
      const skip = setTimeout(() => setPhase('ready'), 0);
      return () => clearTimeout(skip);
    }

    let cancelled = false;
    let errored = false;

    playAudioUrl(audioUrl, {
      onError: () => {
        errored = true;
      },
    }).then(() => {
      if (cancelled) return;
      if (errored) {
        setPhase('ready');
        return;
      }
      readyTimerRef.current = setTimeout(() => {
        if (!cancelled) setPhase('ready');
      }, 2000);
    });

    return () => {
      cancelled = true;
      stopAudio();
      if (readyTimerRef.current) {
        clearTimeout(readyTimerRef.current);
        readyTimerRef.current = null;
      }
    };
  }, [phase, currentIndex, items, playAudioUrl, stopAudio]);

  useEffect(() => {
    if (phase !== 'record') {
      autoRecordStartedRef.current = false;
      return;
    }
    if (autoRecordStartedRef.current) return;
    autoRecordStartedRef.current = true;

    startRecording().then(() => {
      countdown.start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'evaluating') return;
    if (!recordedBlobRef.current) return;

    const blob = recordedBlobRef.current;
    recordedBlobRef.current = null;

    async function evaluate() {
      try {
        const base64 = await blobToBase64(blob);
        const mimeType = blob.type || 'audio/webm;codecs=opus';
        const item = items[currentIndex];
        const outcome = await submitRepetitionAction({
          items,
          bankGroupId: bankGroupIdRef.current,
          phraseIndex: currentIndex,
          audioBase64: base64,
          mimeType,
          sessionId: sessionIdRef.current ?? undefined,
        });
        if ('error' in outcome) throw new Error(outcome.error);
        if (!sessionIdRef.current) onSessionCreated?.(outcome.sessionId);
        sessionIdRef.current = outcome.sessionId;
        setCurrentEvaluation(outcome.feedback);
        setResults((prev) => replaceAt(prev, currentIndex, { item, evaluation: outcome.feedback }));
        setPhase('result');
      } catch (err) {
        console.error('Evaluation error:', err);
        setError(t('listenRepeat.evalFailed'));
        const item = items[currentIndex];
        const fallback = emptyEvaluation(item.text);
        setCurrentEvaluation(fallback);
        setResults((prev) => replaceAt(prev, currentIndex, { item, evaluation: fallback }));
        setPhase('result');
      }
    }

    evaluate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleNext = useCallback(() => {
    setCurrentEvaluation(null);
    setError(null);
    const next = currentIndex + 1;
    if (next >= items.length) {
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        void finishToeflRepeatAction(sessionId).then((outcome) => {
          if ('error' in outcome) setError(t('listenRepeat.evalFailed'));
          else onSessionFinished?.();
        });
      }
      setPhase('finished');
    } else {
      setCurrentIndex(next);
      setPhase('play');
    }
  }, [currentIndex, items.length, onSessionFinished, t]);

  const handleRestart = useCallback(() => {
    setPhase('loading');
    setItems([]);
    sessionIdRef.current = null;
    restoredRef.current = null;
    setLoadKey((key) => key + 1);
    setLoadErrorCode(null);
    setCurrentIndex(0);
    setResults([]);
    setCurrentEvaluation(null);
    setError(null);
    autoRecordStartedRef.current = false;
  }, []);

  const backButton = (
    <button
      onClick={onBack}
      className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium"
    >
      <ArrowLeft size={16} />
      {t('common.back')}
    </button>
  );

  const progressBadge = phase !== 'loading' && phase !== 'finished' ? (
    <span className="text-sm font-semibold text-gray-400">
      {currentIndex + 1} / {items.length}
    </span>
  ) : null;

  if (loadErrorCode) return <ActivityLoadError code={loadErrorCode} onBack={onBack} />;

  return (
    <ChatShell
      animationKey="toefl-listen-repeat"
      headerConfig={{
        icon: Headphones,
        title: t('listenRepeat.headerTitle'),
        subtitle: t('listenRepeat.headerSubtitle'),
        accentColor: 'blue',
        leftSlot: backButton,
        rightSlot: progressBadge,
      }}
      footerConfig={{
        modeLabel: t('listenRepeat.footerMode'),
      }}
      inputSlot={null}
    >
      {phase === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-6 py-12">
          <div
            className="rounded-2xl p-5 w-20 h-20 flex items-center justify-center"
            style={{
              background: 'color-mix(in oklab, var(--color-bob-brand) 8%, white)',
              border: '1px solid color-mix(in oklab, var(--color-bob-brand) 15%, white)',
            }}
          >
            <Headphones size={36} className="text-bob-brand animate-pulse" />
          </div>
          <MessageBubble variant="assistant" accentColor="blue">
            <p className="font-semibold">{t('listenRepeat.preparingSession')}</p>
          </MessageBubble>
        </div>
      )}

      {phase === 'play' && items[currentIndex] && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div
            className="rounded-2xl p-5 w-24 h-24 flex items-center justify-center"
            style={{
              background: 'color-mix(in oklab, var(--color-bob-brand) 8%, white)',
              border: '1px solid color-mix(in oklab, var(--color-bob-brand) 15%, white)',
            }}
          >
            <Headphones size={40} className="text-bob-brand animate-bounce" />
          </div>
          <MessageBubble variant="assistant" accentColor="blue">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              {t('listenRepeat.levelItem', { level: items[currentIndex].difficulty, n: currentIndex + 1 })}
            </p>
            <p className="font-semibold">{t('listenRepeat.listenCarefully')}</p>
            <p className="text-gray-500 text-xs mt-1">{t('listenRepeat.repeatWhenPrompted')}</p>
          </MessageBubble>
        </div>
      )}

      {phase === 'ready' && items[currentIndex] && (
        <div className="flex flex-col gap-4">
          <MessageBubble variant="assistant" accentColor="blue">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              {t('listenRepeat.levelItem', { level: items[currentIndex].difficulty, n: currentIndex + 1 })}
            </p>
            <p className="font-semibold">{t('listenRepeat.getReady')}</p>
            <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 text-left">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">{t('listenRepeat.sentenceLabel')}</p>
              <p className="text-gray-800 font-semibold text-sm blur-sm select-none">
                {items[currentIndex].text}
              </p>
              <p className="text-xs text-gray-400 mt-1 italic">{t('listenRepeat.hiddenHint')}</p>
            </div>
          </MessageBubble>
          <button
            onClick={() => setPhase('record')}
            className="w-full text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            style={{ background: 'var(--color-bob-brand)' }}
          >
            <Mic size={18} />
            {t('listenRepeat.startRecording')}
          </button>
        </div>
      )}

      {phase === 'record' && (
        <div className="flex flex-col items-center gap-6 py-4">
          <MessageBubble variant="assistant" accentColor="blue">
            <p className="font-semibold">{t('listenRepeat.repeatSentence')}</p>
            <p className="text-gray-500 text-xs mt-1">
              {countdown.isRunning ? t('listenRepeat.speakClearly') : t('listenRepeat.processing')}
            </p>
          </MessageBubble>
          <CountdownTimer
            seconds={RECORD_SECONDS}
            remaining={countdown.remaining}
            isRunning={countdown.isRunning}
            size={100}
            strokeWidth={7}
          />
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-semibold text-red-600">{t('common.recording')}</span>
          </div>
          <button
            onClick={() => {
              countdown.stop();
              stopRecording();
            }}
            className="w-full border-2 border-gray-200 hover:border-gray-400 text-gray-700 font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {t('listenRepeat.stopEarly')}
          </button>
        </div>
      )}

      {phase === 'evaluating' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div
            className="rounded-2xl p-4 w-20 h-20 flex items-center justify-center"
            style={{
              background: 'color-mix(in oklab, var(--color-bob-brand) 8%, white)',
              border: '1px solid color-mix(in oklab, var(--color-bob-brand) 15%, white)',
            }}
          >
            <span className="text-3xl animate-spin">⚙️</span>
          </div>
          <MessageBubble variant="assistant" accentColor="blue">
            <p className="font-semibold">{t('listenRepeat.evaluating')}</p>
            <p className="text-gray-500 text-xs mt-1">{t('listenRepeat.analyzingRepetition')}</p>
          </MessageBubble>
        </div>
      )}

      {phase === 'result' && currentEvaluation && items[currentIndex] && (
        <div className="flex flex-col gap-4">
          <MessageBubble variant="assistant" accentColor="blue">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              {t('listenRepeat.item', { n: currentIndex + 1 })}
            </p>
            <p className={`font-black text-base ${currentEvaluation.exact_repetition ? 'text-green-600' : 'text-amber-600'}`}>
              {currentEvaluation.exact_repetition ? t('listenRepeat.perfectRepetition') : t('listenRepeat.almostThere')}
            </p>
          </MessageBubble>

          <InfoCard title={t('listenRepeat.feedback.title')} icon={currentEvaluation.exact_repetition ? CheckCircle2 : AlertCircle}>
            <div className="space-y-2">
              <div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-0.5">{t('listenRepeat.feedback.original')}</p>
                <p className="text-amber-900 font-medium text-sm">{items[currentIndex].text}</p>
              </div>
              {currentEvaluation.transcribed_text ? (
                <div>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-0.5">{t('listenRepeat.feedback.youSaid')}</p>
                  <p className="text-amber-800/70 text-sm italic">{currentEvaluation.transcribed_text}</p>
                </div>
              ) : null}
              {currentEvaluation.missing_words.length > 0 ? (
                <div>
                  <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-0.5">{t('listenRepeat.feedback.missingWords')}</p>
                  <p className="text-red-600 text-sm">{currentEvaluation.missing_words.join(', ')}</p>
                </div>
              ) : null}
              {currentEvaluation.extra_words.length > 0 ? (
                <div>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-0.5">{t('listenRepeat.feedback.extraWords')}</p>
                  <p className="text-amber-700 text-sm">{currentEvaluation.extra_words.join(', ')}</p>
                </div>
              ) : null}
            </div>
          </InfoCard>

          <div className="flex gap-3">
            <button
              onClick={() => setPhase('play')}
              className="flex-1 border-2 border-gray-200 hover:border-gray-400 text-gray-700 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <RotateCcw size={16} />
              {t('listenRepeat.retry')}
            </button>
            <button
              onClick={handleNext}
              className="flex-1 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              style={{ background: 'var(--color-bob-brand)' }}
            >
              {currentIndex + 1 >= items.length ? (
                <>
                  <CheckCircle2 size={18} />
                  {t('common.seeResults')}
                </>
              ) : (
                <>
                  {t('listenRepeat.next')}
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>

          {error ? (
            <p className="text-red-500 text-xs text-center">{error}</p>
          ) : null}
        </div>
      )}

      {phase === 'finished' && (
        <RepeatSummary results={results} onRestart={handleRestart} onBack={onBack} />
      )}
    </ChatShell>
  );
}
