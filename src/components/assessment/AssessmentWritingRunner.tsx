'use client';

import React, { useState, useCallback } from 'react';
import { RotateCcw, ChevronRight } from 'lucide-react';
import { submitAssessmentWritingAction } from '@/actions/assessment';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import type { AssessmentWritingTask } from '@/actions/assessment';

const MIN_WORDS = 30;

interface Props {
  assessment_id: string;
  task: AssessmentWritingTask;
  onQueued: () => void;
  onCancel: () => void;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function AssessmentWritingRunner({ assessment_id, task, onQueued, onCancel }: Props) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'writing' | 'submitting' | 'sent' | 'failed'>('writing');
  const [failMessage, setFailMessage] = useState<string | null>(null);

  const wordCount = countWords(text);
  const canSubmit = wordCount >= MIN_WORDS;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setPhase('submitting');

    const submitResult = await submitAssessmentWritingAction(assessment_id, text);

    if (submitResult.status === 'error') {
      setPhase('failed');
      setFailMessage('Could not submit your writing. Please try again.');
      return;
    }

    setPhase('sent');
    setTimeout(() => onQueued(), 2_000);
  }, [canSubmit, assessment_id, text, onQueued]);

  const handleRetry = useCallback(() => {
    setPhase('writing');
    setFailMessage(null);
  }, []);

  if (phase === 'sent') {
    return <BobMascotLoader size="lg" message="Writing sent! Bob will evaluate it in the background — check your dashboard in a moment." />;
  }

  if (phase === 'submitting') {
    return <BobMascotLoader size="lg" message="Sending your writing…" />;
  }

  if (phase === 'failed') {
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

  const taskLines = task.prompt_text.split('\n');

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 gap-6 max-w-lg mx-auto w-full">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          {taskLines.map((line, i) => {
            if (line.startsWith('•')) {
              return (
                <p key={i} className="text-sm text-gray-700 flex items-start gap-2 pl-1">
                  <span className="text-trebol-primary shrink-0 font-bold mt-0.5">•</span>
                  {line.slice(1).trim()}
                </p>
              );
            }
            if (line.trim() === '') return null;
            return (
              <p key={i} className={`text-sm ${i === 0 ? 'font-bold text-gray-800 text-base' : 'text-gray-600'}`}>
                {line}
              </p>
            );
          })}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={`Start writing here… (at least ${MIN_WORDS} words)`}
          className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-trebol-green/40 focus:border-trebol-green transition"
        />

        <div className="flex justify-between items-center">
          <span className={`text-xs font-semibold ${wordCount >= MIN_WORDS ? 'text-trebol-primary' : 'text-gray-400'}`}>
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
          {wordCount < MIN_WORDS && (
            <span className="text-xs text-gray-400">
              {MIN_WORDS - wordCount} more to unlock Submit
            </span>
          )}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition w-full justify-center ${
          canSubmit
            ? 'bg-trebol-primary text-white hover:opacity-90 shadow-sm'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        Submit <ChevronRight size={16} />
      </button>

      <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600 transition">
        Cancel assessment
      </button>
    </div>
  );
}
