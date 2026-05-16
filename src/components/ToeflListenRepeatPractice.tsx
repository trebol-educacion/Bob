'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Headphones, Mic, RotateCcw, ChevronRight, CheckCircle2 } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import { useCountdown } from '@/hooks/useCountdown';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { pcmToWavBase64, blobToBase64 } from '@/lib/audio';
import {
  generateToeflRepeatSessionAction,
  generateToeflRepeatAudiosAction,
  evaluateRepetitionAction,
  type ToeflRepeatItem,
  type ToeflAudioChunk,
} from '@/actions/modes/toefl_repeat';
import type { RepetitionEvaluation } from '@/lib/types/practice';

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
  evaluation: RepetitionEvaluation;
}

const RECORD_SECONDS = 10;

function scoreColor(score: number): string {
  if (score >= 4) return 'text-green-600';
  if (score >= 2) return 'text-yellow-500';
  return 'text-red-500';
}

function scoreBg(score: number): string {
  if (score >= 4) return 'bg-green-50 border-green-200';
  if (score >= 2) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

function scoreLabel(score: number): string {
  if (score >= 4.5) return 'Excellent';
  if (score >= 3.5) return 'Good';
  if (score >= 2.5) return 'Fair';
  if (score >= 1.5) return 'Needs Work';
  return 'Try Again';
}

interface ToeflListenRepeatPracticeProps {
  onBack: () => void;
}

export function ToeflListenRepeatPractice({ onBack }: ToeflListenRepeatPracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<ToeflRepeatItem[]>([]);
  const [audioChunks, setAudioChunks] = useState<ToeflAudioChunk[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<ItemResult[]>([]);
  const [currentEvaluation, setCurrentEvaluation] = useState<RepetitionEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);
  const autoRecordStartedRef = useRef(false);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const sessionItems = await generateToeflRepeatSessionAction();
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
      // After playback, wait 2s then enter ready phase
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
        const evaluation = await evaluateRepetitionAction(item.text, base64, mimeType);
        setCurrentEvaluation(evaluation);
        setResults((prev) => [...prev, { item, evaluation }]);
        setPhase('result');
      } catch (err) {
        console.error('Evaluation error:', err);
        setError('Evaluation failed. Moving to next item.');
        // Fallback: create a zero-score result and continue
        const item = items[currentIndex];
        const fallback: RepetitionEvaluation = {
          score: 0,
          accuracy: 0,
          pronunciation: 0,
          feedback: 'Evaluation could not be completed.',
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

  const avgScore = results.length > 0
    ? results.reduce((s, r) => s + r.evaluation.score, 0) / results.length
    : 0;
  const avgAccuracy = results.length > 0
    ? results.reduce((s, r) => s + r.evaluation.accuracy, 0) / results.length
    : 0;
  const avgPronunciation = results.length > 0
    ? results.reduce((s, r) => s + r.evaluation.pronunciation, 0) / results.length
    : 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto bg-trebol-bg">
      <div className="sticky top-0 z-10 bg-trebol-bg/90 backdrop-blur-sm border-b border-trebol-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-trebol-text/60 hover:text-trebol-text transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Headphones size={16} className="text-trebol-primary" />
          <span className="text-sm font-bold text-trebol-text">TOEFL Listen &amp; Repeat</span>
        </div>
        {phase !== 'loading' && phase !== 'finished' && (
          <span className="text-sm font-semibold text-trebol-text/50">
            {currentIndex + 1} / {items.length}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6 max-w-lg mx-auto w-full">

        {phase === 'loading' && (
          <div className="w-full space-y-6 text-center">
            <div className="space-y-2">
              <div className="bg-trebol-primary/10 rounded-full p-4 w-20 h-20 mx-auto flex items-center justify-center">
                <Headphones size={36} className="text-trebol-primary animate-pulse" />
              </div>
              <h2 className="text-xl font-black text-trebol-text">Preparing your session...</h2>
              <p className="text-trebol-text/60 text-sm">
                {loadingProgress === 0
                  ? 'Generating 10 sentences...'
                  : `Loading audio ${loadingProgress} of ${items.length || 10}...`}
              </p>
            </div>
            <div className="w-full bg-trebol-border rounded-full h-2 overflow-hidden">
              <div
                className="bg-trebol-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${(loadingProgress / (items.length || 10)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {phase === 'play' && items[currentIndex] && (
          <div className="w-full space-y-6 text-center">
            <div className="bg-trebol-primary/10 rounded-full p-5 w-24 h-24 mx-auto flex items-center justify-center">
              <Headphones size={40} className="text-trebol-primary animate-bounce" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-trebol-text/40 uppercase tracking-widest">
                Level {items[currentIndex].difficulty} · Item {currentIndex + 1}
              </p>
              <h2 className="text-xl font-black text-trebol-text">Listen carefully...</h2>
              <p className="text-trebol-text/60 text-sm">Repeat the sentence when prompted</p>
            </div>
          </div>
        )}

        {phase === 'ready' && items[currentIndex] && (
          <div className="w-full space-y-6 text-center">
            <div className="space-y-2">
              <p className="text-xs font-bold text-trebol-text/40 uppercase tracking-widest">
                Level {items[currentIndex].difficulty} · Item {currentIndex + 1}
              </p>
              <h2 className="text-xl font-black text-trebol-text">Get ready...</h2>
              <div className="bg-white border border-trebol-border rounded-xl p-5 text-left shadow-sm">
                <p className="text-trebol-text/40 text-xs font-semibold uppercase tracking-widest mb-2">Sentence</p>
                <p className="text-trebol-text font-semibold text-base blur-sm select-none">
                  {items[currentIndex].text}
                </p>
                <p className="text-xs text-trebol-text/40 mt-2 italic">Hidden — repeat from memory</p>
              </div>
            </div>
            <button
              onClick={() => setPhase('record')}
              className="w-full bg-trebol-primary hover:bg-trebol-primary/90 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Mic size={18} />
              Start Recording
            </button>
          </div>
        )}

        {phase === 'record' && (
          <div className="w-full space-y-6 text-center">
            <div className="space-y-4">
              <CountdownTimer
                seconds={RECORD_SECONDS}
                remaining={countdown.remaining}
                isRunning={countdown.isRunning}
                size={100}
                strokeWidth={7}
              />
              <div className="space-y-1">
                <h2 className="text-xl font-black text-trebol-text">Repeat the sentence!</h2>
                <p className="text-sm text-trebol-text/60">
                  {countdown.isRunning ? 'Speak clearly and naturally' : 'Processing...'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-semibold text-red-600">Recording</span>
            </div>
            <button
              onClick={() => {
                countdown.stop();
                stopRecording();
              }}
              className="w-full border-2 border-trebol-border hover:border-trebol-primary text-trebol-text font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Stop Early
            </button>
          </div>
        )}

        {phase === 'evaluating' && (
          <div className="w-full space-y-4 text-center">
            <div className="bg-trebol-primary/10 rounded-full p-4 w-20 h-20 mx-auto flex items-center justify-center">
              <span className="text-3xl animate-spin">⚙️</span>
            </div>
            <h2 className="text-xl font-black text-trebol-text">Evaluating...</h2>
            <p className="text-trebol-text/60 text-sm">Analyzing your repetition</p>
          </div>
        )}

        {phase === 'result' && currentEvaluation && items[currentIndex] && (
          <div className="w-full space-y-4">
            <div className={`rounded-2xl border-2 p-6 text-center ${scoreBg(currentEvaluation.score)}`}>
              <p className="text-xs font-bold uppercase tracking-widest text-trebol-text/50 mb-1">
                Item {currentIndex + 1} Score
              </p>
              <p className={`text-6xl font-black ${scoreColor(currentEvaluation.score)}`}>
                {currentEvaluation.score.toFixed(1)}
              </p>
              <p className={`text-sm font-bold mt-1 ${scoreColor(currentEvaluation.score)}`}>
                {scoreLabel(currentEvaluation.score)} / 5.0
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-trebol-border rounded-xl p-3 text-center">
                <p className="text-xs text-trebol-text/50 font-semibold uppercase tracking-wide">Accuracy</p>
                <p className={`text-2xl font-black mt-1 ${scoreColor(currentEvaluation.accuracy)}`}>
                  {currentEvaluation.accuracy.toFixed(1)}
                </p>
              </div>
              <div className="bg-white border border-trebol-border rounded-xl p-3 text-center">
                <p className="text-xs text-trebol-text/50 font-semibold uppercase tracking-wide">Pronunciation</p>
                <p className={`text-2xl font-black mt-1 ${scoreColor(currentEvaluation.pronunciation)}`}>
                  {currentEvaluation.pronunciation.toFixed(1)}
                </p>
              </div>
            </div>

            <div className="bg-white border border-trebol-border rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs font-bold text-trebol-text/40 uppercase tracking-widest mb-1">Original</p>
                <p className="text-trebol-text font-medium text-sm">{items[currentIndex].text}</p>
              </div>
              {currentEvaluation.transcribed_text && (
                <div>
                  <p className="text-xs font-bold text-trebol-text/40 uppercase tracking-widest mb-1">You said</p>
                  <p className="text-trebol-text/70 text-sm italic">{currentEvaluation.transcribed_text}</p>
                </div>
              )}
            </div>

            <div className="bg-trebol-secondary/10 border border-trebol-secondary/20 rounded-xl p-4">
              <p className="text-trebol-text text-sm font-medium">{currentEvaluation.feedback}</p>
            </div>

            <button
              onClick={handleNext}
              className="w-full bg-trebol-primary hover:bg-trebol-primary/90 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
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

            {error && (
              <p className="text-red-500 text-xs text-center">{error}</p>
            )}
          </div>
        )}

        {phase === 'finished' && (
          <div className="w-full space-y-6">
            <div className={`rounded-2xl border-2 p-6 text-center ${scoreBg(avgScore)}`}>
              <p className="text-xs font-bold uppercase tracking-widest text-trebol-text/50 mb-1">Session Score</p>
              <p className={`text-7xl font-black ${scoreColor(avgScore)}`}>
                {avgScore.toFixed(1)}
              </p>
              <p className={`text-base font-bold mt-1 ${scoreColor(avgScore)}`}>
                {scoreLabel(avgScore)} · avg / 5.0
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-trebol-border rounded-xl p-3 text-center">
                <p className="text-xs text-trebol-text/50 font-semibold uppercase tracking-wide">Avg Accuracy</p>
                <p className={`text-2xl font-black mt-1 ${scoreColor(avgAccuracy)}`}>
                  {avgAccuracy.toFixed(1)}
                </p>
              </div>
              <div className="bg-white border border-trebol-border rounded-xl p-3 text-center">
                <p className="text-xs text-trebol-text/50 font-semibold uppercase tracking-wide">Avg Pronunciation</p>
                <p className={`text-2xl font-black mt-1 ${scoreColor(avgPronunciation)}`}>
                  {avgPronunciation.toFixed(1)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-trebol-text/40 uppercase tracking-widest mb-3">Item Breakdown</p>
              <div className="grid grid-cols-5 gap-2">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border-2 p-2 text-center ${scoreBg(r.evaluation.score)}`}
                    title={r.item.text}
                  >
                    <p className="text-xs text-trebol-text/50 font-semibold">{i + 1}</p>
                    <p className={`text-lg font-black ${scoreColor(r.evaluation.score)}`}>
                      {r.evaluation.score.toFixed(0)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRestart}
                className="flex-1 border-2 border-trebol-border hover:border-trebol-primary text-trebol-text font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                Try Again
              </button>
              <button
                onClick={onBack}
                className="flex-1 bg-trebol-primary hover:bg-trebol-primary/90 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

