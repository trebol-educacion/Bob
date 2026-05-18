'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RotateCcw, ChevronRight } from 'lucide-react';
import { submitAssessmentWritingAction, pollAssessmentWritingResultAction } from '@/actions/assessment';
import type { AssessmentWritingTask } from '@/actions/assessment';
import type { AssessmentResultWriting } from '@/lib/types/skills';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90000;
const MIN_WORDS = 30;

interface Props {
  assessment_id: string;
  task: AssessmentWritingTask;
  onResult: (result: AssessmentResultWriting) => void;
  onCancel: () => void;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function AssessmentWritingRunner({ assessment_id, task, onResult, onCancel }: Props) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'writing' | 'evaluating' | 'failed'>('writing');
  const [failMessage, setFailMessage] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wordCount = countWords(text);
  const canSubmit = wordCount >= MIN_WORDS;

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startPolling = useCallback((id: string) => {
    pollTimeoutRef.current = setTimeout(() => {
      stopPolling();
      setPhase('failed');
      setFailMessage("We couldn't evaluate your writing. Please try again.");
    }, POLL_TIMEOUT_MS);

    pollIntervalRef.current = setInterval(async () => {
      const poll = await pollAssessmentWritingResultAction(id);
      if (poll.status === 'done') {
        stopPolling();
        onResult(poll.result);
      } else if (poll.status === 'failed') {
        stopPolling();
        setPhase('failed');
        setFailMessage("We couldn't evaluate your writing. Please try again.");
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, onResult]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setPhase('evaluating');

    const submitResult = await submitAssessmentWritingAction(assessment_id, text);

    if (submitResult.status === 'error') {
      setPhase('failed');
      setFailMessage('Could not submit your writing. Please try again.');
      return;
    }

    startPolling(assessment_id);
  }, [canSubmit, assessment_id, text, startPolling]);

  const handleRetry = useCallback(() => {
    stopPolling();
    setPhase('writing');
    setFailMessage(null);
  }, [stopPolling]);

  if (phase === 'evaluating') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
        <div className="text-5xl animate-pulse">✍️</div>
        <p className="text-xl font-black text-gray-800">Evaluating your writing…</p>
        <p className="text-sm text-gray-500">This usually takes a few seconds.</p>
      </div>
    );
  }

  if (phase === 'failed') {
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

  const taskLines = task.prompt_text.split('\n');

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 gap-6 max-w-lg mx-auto w-full">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          {taskLines.map((line, i) => {
            if (line.startsWith('•')) {
              return (
                <p key={i} className="text-sm text-gray-700 flex items-start gap-2 pl-1">
                  <span className="text-trebol-green shrink-0 font-bold mt-0.5">•</span>
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
          <span className={`text-xs font-semibold ${wordCount >= MIN_WORDS ? 'text-trebol-green' : 'text-gray-400'}`}>
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
            ? 'bg-trebol-green text-white hover:opacity-90 shadow-sm'
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
