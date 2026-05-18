'use client';

import React, { useState, useCallback } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { submitAssessmentReadingAction } from '@/actions/assessment';
import type { AssessmentReadingItem } from '@/actions/assessment';
import type { AssessmentResultReading } from '@/lib/types/skills';

interface Props {
  assessment_id: string;
  items: AssessmentReadingItem[];
  onResult: (result: AssessmentResultReading) => void;
  onCancel: () => void;
}

export function AssessmentReadingRunner({ assessment_id, items, onResult, onCancel }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failMessage, setFailMessage] = useState<string | null>(null);

  const currentItem = items[currentIdx];
  const isLastItem = currentIdx === items.length - 1;

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
    }
  }, [selectedKey, currentItem, answers, isLastItem]);

  const handleSubmit = useCallback(async (finalAnswers: Record<string, string>) => {
    setSubmitting(true);

    const answerArray = Object.entries(finalAnswers).map(([item_id, selected_key]) => ({
      item_id,
      selected_key,
    }));

    const result = await submitAssessmentReadingAction(assessment_id, answerArray);

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
    setSubmitting(false);
    setFailed(false);
    setFailMessage(null);
  }, []);

  if (submitting) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
        <div className="text-5xl animate-pulse">📊</div>
        <p className="text-xl font-black text-gray-800">Calculating your result…</p>
        <p className="text-sm text-gray-500">Just a moment!</p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
        <div className="text-4xl">😔</div>
        <p className="text-lg font-bold text-gray-800">Something went wrong</p>
        <p className="text-sm text-gray-500 max-w-xs">{failMessage}</p>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-5 py-2.5 bg-trebol-green text-white rounded-xl font-semibold text-sm hover:opacity-90 transition"
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
                ? 'bg-trebol-green'
                : i === currentIdx
                ? 'bg-trebol-green/40'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Question {currentIdx + 1} of {items.length}
      </p>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 w-full flex flex-col gap-4">
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {currentItem?.stimulus_text}
          </p>
        </div>

        <p className="text-base font-bold text-gray-800">
          {currentItem?.question}
        </p>

        <div className="flex flex-col gap-2">
          {currentItem?.options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleSelectOption(opt.key)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition ${
                selectedKey === opt.key
                  ? 'border-trebol-green bg-trebol-green/5 text-trebol-green'
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
            ? 'bg-trebol-green text-white hover:opacity-90 shadow-sm'
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
