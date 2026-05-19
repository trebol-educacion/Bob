'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Headphones, Mic, RotateCcw, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import { useCountdown } from '@/hooks/useCountdown';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { pcmToWavBase64, blobToBase64 } from '@/lib/audio';
import {
  generateToeflRepeatSessionAction,
  generateToeflRepeatAudiosAction,
  evaluateRepetitionAction,
  saveToeflRepeatSummaryAction,
  type ToeflRepeatItem,
  type ToeflAudioChunk,
} from '@/actions/modes/toefl_repeat';
import { createSessionAction } from '@/actions/sessions';
import type { RepetitionObjectiveFeedback } from '@/lib/types/practice';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
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

interface ToeflListenRepeatPracticeProps {
  onBack: () => void;
}

/** Main component for the TOEFL Listen & Repeat practice mode. */
export function ToeflListenRepeatPractice({ onBack }: ToeflListenRepeatPracticeProps) {
  const t = useTranslations('toefl');
  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<ToeflRepeatItem[]>([]);
  const [audioChunks, setAudioChunks] = useState<ToeflAudioChunk[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<ItemResult[]>([]);
  const [currentEvaluation, setCurrentEvaluation] = useState<RepetitionObjectiveFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);
  const autoRecordStartedRef = useRef(false);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string>('');
  const userIdRef = useRef<string>('');

  const countdown = useCountdown({
    seconds: RECORD_SECONDS,
    onComplete: () => {
      stopRecording();
    },
  });

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
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
    let cancelled = false;

    async function load() {
      try {
        const sessionResult = await createSessionAction({ mode: 'toefl_listen_repeat', title: 'TOEFL Listen & Repeat' });
        if (cancelled) return;
        if (!sessionResult.data) {
          setError(t('listenRepeat.sessionError'));
          return;
        }
        sessionIdRef.current = sessionResult.data.id;
        userIdRef.current = sessionResult.data.user_id;

        const sessionItems = await generateToeflRepeatSessionAction(sessionIdRef.current, userIdRef.current);
        if (cancelled) return;
        setItems(sessionItems);
        setLoadingProgress(1);

        const phrases = sessionItems.map((it) => it.text);
        const BATCH_SIZE = 3;
        const allChunks: ToeflAudioChunk[] = new Array(phrases.length);
        let loaded = 0;

        for (let i = 0; i < phrases.length; i += BATCH_SIZE) {
          const batch = phrases.slice(i, i + BATCH_SIZE);
          const batchChunks = await generateToeflRepeatAudiosAction(batch);
          if (cancelled) return;
          batchChunks.forEach((chunk, j) => {
            allChunks[i + j] = chunk;
          });
          loaded += batch.length;
          setLoadingProgress(1 + loaded);
        }

        if (cancelled) return;
        setAudioChunks(allChunks);
        setPhase('play');
      } catch (err) {
        if (!cancelled) {
          console.error('Load error:', err);
          setError(t('listenRepeat.loadError'));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (phase !== 'play') return;
    const chunk = audioChunks[currentIndex];
    if (!chunk) return;

    const wavUrl = pcmToWavBase64(chunk.data, chunk.mimeType);
    const audio = new Audio(wavUrl);
    audioRef.current = audio;

    audio.onended = () => {
      readyTimerRef.current = setTimeout(() => {
        setPhase('ready');
      }, 2000);
    };

    audio.onerror = () => {
      setPhase('ready');
    };

    audio.play().catch(() => setPhase('ready'));

    return () => {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      if (readyTimerRef.current) {
        clearTimeout(readyTimerRef.current);
        readyTimerRef.current = null;
      }
    };
  }, [phase, currentIndex, audioChunks]);

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
        const evaluation = await evaluateRepetitionAction(
          item.text,
          base64,
          mimeType,
          sessionIdRef.current,
          userIdRef.current,
          currentIndex
        );
        setCurrentEvaluation(evaluation);
        setResults((prev) => [...prev, { item, evaluation }]);
        setPhase('result');
      } catch (err) {
        console.error('Evaluation error:', err);
        setError(t('listenRepeat.evalFailed'));
        const item = items[currentIndex];
        const fallback: RepetitionObjectiveFeedback = {
          kind: 'repetition_objective',
          exact_repetition: false,
          missing_words: [],
          extra_words: [],
          transcribed_text: '',
          original_text: item.text,
        };
        setCurrentEvaluation(fallback);
        setResults((prev) => [...prev, { item, evaluation: fallback }]);
        setPhase('result');
      }
    }

    evaluate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'finished') return;
    if (results.length === 0) return;
    if (!sessionIdRef.current || !userIdRef.current) return;

    const exactCount = results.filter((r) => r.evaluation.exact_repetition).length;

    saveToeflRepeatSummaryAction(sessionIdRef.current, userIdRef.current, {
      exactCount,
      totalCount: results.length,
      itemCount: results.length,
    }).catch((err) => {
      console.error('[ToeflRepeat persist] summary error:', err);
    });
  }, [phase, results]);

  const handleNext = useCallback(() => {
    setCurrentEvaluation(null);
    setError(null);
    const next = currentIndex + 1;
    if (next >= items.length) {
      setPhase('finished');
    } else {
      setCurrentIndex(next);
      setPhase('play');
    }
  }, [currentIndex, items.length]);

  const handleRestart = useCallback(() => {
    setPhase('loading');
    setItems([]);
    setAudioChunks([]);
    setLoadingProgress(0);
    setCurrentIndex(0);
    setResults([]);
    setCurrentEvaluation(null);
    setError(null);
    autoRecordStartedRef.current = false;
  }, []);

  const exactCount = results.filter((r) => r.evaluation.exact_repetition).length;

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

  const loadingBar = (
    <div className="w-full space-y-2">
      <p className="text-xs text-gray-500 text-center">
        {loadingProgress === 0
          ? t('listenRepeat.loadingGenerating')
          : t('listenRepeat.loadingAudio', { current: loadingProgress, total: items.length || 10 })}
      </p>
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ background: 'var(--color-bob-brand)', width: `${(loadingProgress / (items.length || 10)) * 100}%` }}
        />
      </div>
    </div>
  );

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
        modelName: ACTIVE_MODEL_LABEL,
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
            <div className="mt-3">{loadingBar}</div>
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
        <div className="flex flex-col gap-6">
          <MessageBubble variant="assistant" accentColor="blue">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('listenRepeat.finished.sessionComplete')}</p>
            <p className="text-4xl font-black text-bob-brand">{exactCount} / {results.length}</p>
            <p className="text-sm font-bold text-gray-400 mt-1">{t('listenRepeat.finished.exactRepetitions')}</p>
          </MessageBubble>

          <InfoCard title={t('listenRepeat.finished.itemBreakdown')}>
            <div className="grid grid-cols-5 gap-2">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-xl border-2 p-2 text-center ${r.evaluation.exact_repetition ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}
                  title={r.item.text}
                >
                  <p className="text-xs text-gray-400 font-semibold">{i + 1}</p>
                  <p className={`text-lg font-black ${r.evaluation.exact_repetition ? 'text-green-600' : 'text-amber-500'}`}>
                    {r.evaluation.exact_repetition ? '✓' : '~'}
                  </p>
                </div>
              ))}
            </div>
          </InfoCard>

          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex-1 border-2 border-gray-200 hover:border-gray-400 text-gray-700 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} />
              {t('common.tryAgain')}
            </button>
            <button
              onClick={onBack}
              className="flex-1 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              style={{ background: 'var(--color-bob-brand)' }}
            >
              <ArrowLeft size={16} />
              {t('common.back')}
            </button>
          </div>
        </div>
      )}
    </ChatShell>
  );
}
