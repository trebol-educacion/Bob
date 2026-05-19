'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ChevronRight, RotateCcw, Volume2 } from 'lucide-react';
import { submitAssessmentListeningAction } from '@/actions/assessment';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import type { AssessmentListeningItem } from '@/actions/assessment';
import type { AssessmentResultListening } from '@/lib/types/skills';

interface Props {
  assessment_id: string;
  items: AssessmentListeningItem[];
  onResult: (result: AssessmentResultListening) => void;
  onCancel: () => void;
}

const MAX_PLAYS = 2;

export function AssessmentListeningRunner({ assessment_id, items, onResult, onCancel }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [playsUsed, setPlaysUsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failMessage, setFailMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentItem = items[currentIdx];
  const isLastItem = currentIdx === items.length - 1;
  const canPlay = playsUsed < MAX_PLAYS;

  const handlePlay = useCallback(() => {
    if (!canPlay || !currentItem) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const audio = new Audio(currentItem.audio_url);
    audioRef.current = audio;
    audio.play().catch(() => {});
    setPlaysUsed(prev => prev + 1);
  }, [canPlay, currentItem]);

  const handleSelectOption = useCallback((key: string) => {
    setSelectedKey(key);
  }, []);

  const handleNext = useCallback(() => {
    if (!selectedKey || !currentItem) return;

    const updatedAnswers = { ...answers, [currentItem.id]: selectedKey };
    setAnswers(updatedAnswers);

    if (isLastItem) {
      handleSubmit(updatedAnswers);
    } else {
      setCurrentIdx(prev => prev + 1);
      setSelectedKey(null);
      setPlaysUsed(0);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }
  }, [selectedKey, currentItem, answers, isLastItem]);

  const handleSubmit = useCallback(async (finalAnswers: Record<string, string>) => {
    setSubmitting(true);

    const answerArray = Object.entries(finalAnswers).map(([item_id, selected_key]) => ({
      item_id,
      selected_key,
    }));

    const result = await submitAssessmentListeningAction(assessment_id, answerArray);

    if (result.status === 'error') {
      setSubmitting(false);
      setFailed(true);
      setFailMessage('Could not submit your answers. Please try again.');
      return;
    }

    onResult(result.result);
  }, [assessment_id, onResult]);

  const handleRetry = useCallback(() => {
    setCurrentIdx(0);
    setAnswers({});
    setSelectedKey(null);
    setPlaysUsed(0);
    setSubmitting(false);
    setFailed(false);
    setFailMessage(null);
    audioRef.current = null;
  }, []);

  if (submitting) {
    return <BobMascotLoader size="lg" message="Calculating your result…" />;
  }

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
        <div className="text-4xl">😔</div>
        <p className="text-lg font-bold text-gray-800">Something went wrong</p>
        <p className="text-sm text-gray-500 max-w-xs">{failMessage}</p>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-5 py-2.5 bg-trebol-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 transition"
        >
          <RotateCcw size={16} /> Try again
        </button>
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600 transition">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 gap-6 max-w-lg mx-auto w-full">
      <div className="w-full flex items-center gap-2 mb-2">
        {items.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i < currentIdx
                ? 'bg-trebol-primary'
                : i === currentIdx
                ? 'bg-trebol-primary/40'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Question {currentIdx + 1} of {items.length}
      </p>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 w-full flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handlePlay}
            disabled={!canPlay}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition ${
              canPlay
                ? 'bg-trebol-primary text-white hover:opacity-90'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Volume2 size={16} />
            {playsUsed === 0 ? 'Play audio' : playsUsed >= MAX_PLAYS ? 'Audio played' : 'Play again'}
          </button>
          <p className="text-xs text-gray-400">
            {playsUsed === 0
              ? `You can listen up to ${MAX_PLAYS} times`
              : playsUsed >= MAX_PLAYS
              ? 'Maximum plays reached'
              : `${MAX_PLAYS - playsUsed} play${MAX_PLAYS - playsUsed !== 1 ? 's' : ''} remaining`}
          </p>
        </div>

        <p className="text-base font-bold text-gray-800 text-center">
          {currentItem?.question}
        </p>

        <div className="flex flex-col gap-2">
          {currentItem?.options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleSelectOption(opt.key)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition ${
                selectedKey === opt.key
                  ? 'border-trebol-green bg-trebol-primary/5 text-trebol-primary'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="font-bold mr-2">{opt.key}.</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleNext}
        disabled={!selectedKey}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition w-full justify-center ${
          selectedKey
            ? 'bg-trebol-primary text-white hover:opacity-90 shadow-sm'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isLastItem ? 'Submit' : 'Next'}
        <ChevronRight size={16} />
      </button>

      <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600 transition">
        Cancel assessment
      </button>
    </div>
  );
}
