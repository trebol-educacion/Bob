'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { FormativeFeedback } from '@/lib/types/practice';

/** Per-question formative feedback card of the TOEFL interview. */
export function FormativeFeedbackCard({ feedback }: { feedback: FormativeFeedback }) {
  const t = useTranslations('toefl.interview.feedback');
  return (
    <div className="w-full space-y-3">
      <div className={`text-center py-2 px-4 rounded-xl font-bold text-sm ${feedback.understood ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
        {feedback.understood ? t('understood') : t('notUnderstood')}
      </div>
      {feedback.highlights.length > 0 && (
        <div className="bg-green-50 rounded-xl p-3 space-y-1">
          <p className="text-xs font-bold text-green-700 uppercase tracking-widest">{t('strengths')}</p>
          {feedback.highlights.map((h, i) => (
            <p key={i} className="text-sm text-green-800">✓ {h}</p>
          ))}
        </div>
      )}
      {feedback.suggestions.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-3 space-y-1">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">{t('tips')}</p>
          {feedback.suggestions.map((s, i) => (
            <p key={i} className="text-sm text-amber-800">→ {s}</p>
          ))}
        </div>
      )}
      {feedback.model_answer && (
        <div
          className="rounded-xl p-3 space-y-1"
          style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 8%, white)' }}
        >
          <p className="text-xs font-bold text-bob-brand uppercase tracking-widest">{t('example')}</p>
          <p className="text-sm text-gray-800 italic">&quot;{feedback.model_answer}&quot;</p>
        </div>
      )}
    </div>
  );
}
