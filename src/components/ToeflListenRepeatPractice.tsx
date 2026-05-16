'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
      setError('Microphone error. Please check permissions and try again.');
    },
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const sessionResult = await createSessionAction({ mode: 'toefl_listen_repeat', title: 'TOEFL Listen & Repeat' });
        if (cancelled) return;
        if (!sessionResult.data) {
          setError('Could not start session. Please try again.');
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
          setError('Failed to load session. Please try again.');
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
        setError('Evaluation failed. Moving to next item.');
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
      Back
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
          ? 'Generating sentences…'
          : `Loading audio ${loadingProgress} of ${items.length || 10}…`}
      </p>
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-500"
          style={{ width: `${(loadingProgress / (items.length || 10)) * 100}%` }}
        />
      </div>
    </div>
  );

  return (
    <ChatShell
      animationKey="toefl-listen-repeat"
      headerConfig={{
        icon: Headphones,
        title: 'TOEFL Listen & Repeat',
        subtitle: 'Listen, then repeat the sentence exactly',
        accentColor: 'blue',
        leftSlot: backButton,
        rightSlot: progressBadge,
      }}
      footerConfig={{
        modeLabel: 'TOEFL · LISTEN & REPEAT',
        modelName: ACTIVE_MODEL_LABEL,
      }}
      inputSlot={null}
    >
      {phase === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-6 py-12">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 w-20 h-20 flex items-center justify-center">
            <Headphones size={36} className="text-blue-600 animate-pulse" />
          </div>
          <MessageBubble variant="assistant" accentColor="blue">
            <p className="font-semibold">Preparing your session…</p>
            <div className="mt-3">{loadingBar}</div>
          </MessageBubble>
        </div>
      )}

      {phase === 'play' && items[currentIndex] && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 w-24 h-24 flex items-center justify-center">
            <Headphones size={40} className="text-blue-600 animate-bounce" />
          </div>
          <MessageBubble variant="assistant" accentColor="blue">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              Level {items[currentIndex].difficulty} · Item {currentIndex + 1}
            </p>
            <p className="font-semibold">Listen carefully…</p>
            <p className="text-gray-500 text-xs mt-1">Repeat the sentence when prompted</p>
          </MessageBubble>
        </div>
      )}

      {phase === 'ready' && items[currentIndex] && (
        <div className="flex flex-col gap-4">
          <MessageBubble variant="assistant" accentColor="blue">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              Level {items[currentIndex].difficulty} · Item {currentIndex + 1}
            </p>
            <p className="font-semibold">Get ready…</p>
            <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 text-left">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">Sentence</p>
              <p className="text-gray-800 font-semibold text-sm blur-sm select-none">
                {items[currentIndex].text}
              </p>
              <p className="text-xs text-gray-400 mt-1 italic">Hidden — repeat from memory</p>
            </div>
          </MessageBubble>
          <button
            onClick={() => setPhase('record')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Mic size={18} />
            Start Recording
          </button>
        </div>
      )}

      {phase === 'record' && (
        <div className="flex flex-col items-center gap-6 py-4">
          <MessageBubble variant="assistant" accentColor="blue">
            <p className="font-semibold">Repeat the sentence!</p>
            <p className="text-gray-500 text-xs mt-1">
              {countdown.isRunning ? 'Speak clearly and naturally' : 'Processing…'}
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
            <span className="text-sm font-semibold text-red-600">Recording</span>
          </div>
          <button
            onClick={() => {
              countdown.stop();
              stopRecording();
            }}
            className="w-full border-2 border-gray-200 hover:border-blue-600 text-gray-700 font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Stop Early
          </button>
        </div>
      )}

      {phase === 'evaluating' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 w-20 h-20 flex items-center justify-center">
            <span className="text-3xl animate-spin">⚙️</span>
          </div>
          <MessageBubble variant="assistant" accentColor="blue">
            <p className="font-semibold">Evaluating…</p>
            <p className="text-gray-500 text-xs mt-1">Analyzing your repetition</p>
          </MessageBubble>
        </div>
      )}

      {phase === 'result' && currentEvaluation && items[currentIndex] && (
        <div className="flex flex-col gap-4">
          <MessageBubble variant="assistant" accentColor="blue">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              Item {currentIndex + 1}
            </p>
            <p className={`font-black text-base ${currentEvaluation.exact_repetition ? 'text-green-600' : 'text-amber-600'}`}>
              {currentEvaluation.exact_repetition ? 'Perfect repetition!' : 'Almost there!'}
            </p>
          </MessageBubble>

          <InfoCard title="Feedback" icon={currentEvaluation.exact_repetition ? CheckCircle2 : AlertCircle}>
            <div className="space-y-2">
              <div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-0.5">Original</p>
                <p className="text-amber-900 font-medium text-sm">{items[currentIndex].text}</p>
              </div>
              {currentEvaluation.transcribed_text ? (
                <div>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-0.5">You said</p>
                  <p className="text-amber-800/70 text-sm italic">{currentEvaluation.transcribed_text}</p>
                </div>
              ) : null}
              {currentEvaluation.missing_words.length > 0 ? (
                <div>
                  <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-0.5">Missing words</p>
                  <p className="text-red-600 text-sm">{currentEvaluation.missing_words.join(', ')}</p>
                </div>
              ) : null}
              {currentEvaluation.extra_words.length > 0 ? (
                <div>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-0.5">Extra words</p>
                  <p className="text-amber-700 text-sm">{currentEvaluation.extra_words.join(', ')}</p>
                </div>
              ) : null}
            </div>
          </InfoCard>

          <div className="flex gap-3">
            <button
              onClick={() => setPhase('play')}
              className="flex-1 border-2 border-gray-200 hover:border-blue-600 text-gray-700 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <RotateCcw size={16} />
              Retry
            </button>
            <button
              onClick={handleNext}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {currentIndex + 1 >= items.length ? (
                <>
                  <CheckCircle2 size={18} />
                  See Results
                </>
              ) : (
                <>
                  Next
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
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Session Complete</p>
            <p className="text-4xl font-black text-blue-600">{exactCount} / {results.length}</p>
            <p className="text-sm font-bold text-gray-400 mt-1">exact repetitions</p>
          </MessageBubble>

          <InfoCard title="Item Breakdown">
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
              className="flex-1 border-2 border-gray-200 hover:border-blue-600 text-gray-700 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} />
              Try Again
            </button>
            <button
              onClick={onBack}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          </div>
        </div>
      )}
    </ChatShell>
  );
}
