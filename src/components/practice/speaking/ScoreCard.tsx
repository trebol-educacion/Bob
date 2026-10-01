'use client';

import React from 'react';
import type { FormativeFeedback } from '@/lib/types/practice';

const CRITERION_LABELS: Record<string, string> = {
  grammar_and_vocabulary: 'Grammar and vocabulary',
  discourse_management: 'Discourse management',
  pronunciation: 'Pronunciation',
  interactive_communication: 'Interactive communication',
};

const CRITERION_MAX = 5;

export function ScoreCard({ feedback }: { feedback: FormativeFeedback }) {
  if (feedback.score10 === undefined) return null;
  const bands = Object.entries(feedback.band_per_criterion ?? {});

  return (
    <div data-testid="speaking-score" className="rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-4 space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your grade</p>
          <p className="text-3xl font-black text-gray-900">
            <span data-testid="speaking-score-value">{feedback.score10.toFixed(1)}</span>
            <span className="text-base font-bold text-gray-400"> / 10</span>
          </p>
        </div>
        {feedback.cefr_band && (
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-bold uppercase tracking-widest text-gray-600">
            {feedback.cefr_band}
          </span>
        )}
      </div>
      {bands.length > 0 && (
        <ul className="space-y-1.5">
          {bands.map(([key, band]) => (
            <li key={key} className="space-y-0.5">
              <div className="flex justify-between text-xs text-gray-600">
                <span>{CRITERION_LABELS[key] ?? key}</span>
                <span className="font-semibold">{band}/{CRITERION_MAX}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-green-500" style={{ width: `${(band / CRITERION_MAX) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {feedback.feedback && <p className="text-sm text-gray-700 leading-relaxed">{feedback.feedback}</p>}
    </div>
  );
}
