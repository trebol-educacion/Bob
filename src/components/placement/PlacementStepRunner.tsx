'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronRight, RotateCcw, Volume2 } from 'lucide-react';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { PlacementProgress } from './PlacementProgress';
import type { ClosedAnswer } from '@/lib/item-bank/scoring';
import type { PublicBankItem, PublicItemGroup } from '@/lib/item-bank/types';

export interface PlacementStepRunnerProps {
  group: PublicItemGroup;
  items: PublicBankItem[];
  stepsCompleted: number;
  submitting: boolean;
  failed: boolean;
  onSubmitStep: (answers: ClosedAnswer[]) => void;
  onCancel: () => void;
}

const MAX_PLAYS = 2;

/** @param props PlacementStepRunnerProps */
export function PlacementStepRunner({
  group,
  items,
  stepsCompleted,
  submitting,
  failed,
  onSubmitStep,
  onCancel,
}: PlacementStepRunnerProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [playsUsed, setPlaysUsed] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const currentItem = items[currentIdx];
  const isLastItem = currentIdx === items.length - 1;
  const audioUrl = currentItem?.stimulus_audio_url ?? group.stimulus_audio_url;
  const stimulusText = currentItem?.stimulus_text ?? group.stimulus_text;
  const canPlay = Boolean(audioUrl) && playsUsed < MAX_PLAYS;

  const handlePlay = useCallback(() => {
    if (!audioUrl || playsUsed >= MAX_PLAYS) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play().catch(() => {});
    setPlaysUsed((n) => n + 1);
  }, [audioUrl, playsUsed]);

  const handleSelectOption = useCallback((key: string) => {
    setSelectedKey(key);
  }, []);

  const handleNext = useCallback(() => {
    if (!selectedKey || !currentItem) return;

    const updatedAnswers = { ...answers, [currentItem.id]: selectedKey };
    setAnswers(updatedAnswers);

    if (isLastItem) {
      const answerArray: ClosedAnswer[] = Object.entries(updatedAnswers).map(([item_id, selected_key]) => ({
        item_id,
        selected_key,
      }));
      onSubmitStep(answerArray);
      return;
    }

    setCurrentIdx((prev) => prev + 1);
    setSelectedKey(null);
    setPlaysUsed(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [selectedKey, currentItem, answers, isLastItem, onSubmitStep]);

  const handleRetry = useCallback(() => {
    const answerArray: ClosedAnswer[] = Object.entries(answers).map(([item_id, selected_key]) => ({
      item_id,
      selected_key,
    }));
    onSubmitStep(answerArray);
  }, [answers, onSubmitStep]);

  if (submitting) {
    return <BobMascotLoader size="lg" message="Checking your answers…" />;
  }

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
        <div className="text-4xl">😔</div>
        <p className="text-lg font-bold text-gray-800">Something went wrong</p>
        <p className="text-sm text-gray-500 max-w-xs">Could not submit your answers. Please try again.</p>
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
      <PlacementProgress stepsCompleted={stepsCompleted} />

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Question {currentIdx + 1} of {items.length}
      </p>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 w-full flex flex-col gap-4">
        {audioUrl && (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handlePlay}
              disabled={!canPlay}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition ${
                canPlay ? 'bg-trebol-primary text-white hover:opacity-90' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Volume2 size={16} />
              {playsUsed === 0 ? 'Play audio' : playsUsed >= MAX_PLAYS ? 'Audio played' : 'Play again'}
            </button>
          </div>
        )}

        {stimulusText && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{stimulusText}</p>
          </div>
        )}

        <p className="text-base font-bold text-gray-800">{currentItem?.question}</p>

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
          selectedKey ? 'bg-trebol-primary text-white hover:opacity-90 shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isLastItem ? 'Continue' : 'Next'}
        <ChevronRight size={16} />
      </button>

      <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600 transition">
        Cancel assessment
      </button>
    </div>
  );
}
