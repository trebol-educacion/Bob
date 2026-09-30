'use client';

import React from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { InfoCard } from '@/components/chat';
import type { FormativeFeedback } from '@/lib/types/practice';
import { ScoreCard } from '../ScoreCard';

export function CollaborativeFeedbackPanel({ feedback }: { feedback: FormativeFeedback }) {
  return (
    <div className="space-y-4">
      <ScoreCard feedback={feedback} />
      <div className={`text-center py-3 px-4 rounded-xl font-bold text-sm ${feedback.understood ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
        {feedback.understood ? 'Great discussion, your ideas came through clearly!' : 'Good effort, keep practising!'}
      </div>
      {feedback.highlights.length > 0 && (
        <InfoCard title="What went well" icon={CheckCircle2}>
          <ul className="space-y-2">
            {feedback.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-green-600" />
                {h}
              </li>
            ))}
          </ul>
        </InfoCard>
      )}
      {feedback.suggestions.length > 0 && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <ChevronRight size={14} className="text-amber-600 shrink-0" />
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Tips to improve</span>
          </div>
          <ul className="space-y-2 text-sm text-amber-800/80">
            {feedback.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight size={14} className="mt-0.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {feedback.model_answer && (
        <div
          className="rounded-2xl p-4 space-y-1"
          style={{
            background: 'color-mix(in oklab, var(--color-bob-brand) 8%, white)',
            border: '1px solid color-mix(in oklab, var(--color-bob-brand) 15%, white)',
          }}
        >
          <p className="text-xs font-bold text-bob-brand uppercase tracking-widest">Example phrase</p>
          <p className="text-sm text-gray-800 italic">&quot;{feedback.model_answer}&quot;</p>
        </div>
      )}
    </div>
  );
}
