'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { FCE_CRITERIA, type FceRubric } from '@/lib/writing/fce-rubric';

export interface FceScoreCardProps {
  score10: number;
  rubric: FceRubric;
}

export function FceScoreCard({ score10, rubric }: FceScoreCardProps) {
  const t = useTranslations('cambridge');
  return (
    <div
      className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3 space-y-3"
      data-testid="fce-score-card"
    >
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
          {t('fce.score.title')}
        </p>
        <p className="text-2xl font-bold text-bob-brand" data-testid="fce-score-10">
          {score10}
          <span className="text-sm text-gray-400">/10</span>
        </p>
      </div>
      <ul className="space-y-1.5">
        {FCE_CRITERIA.map((criterion) => (
          <li key={criterion} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-40 shrink-0">{t(`fce.score.criteria.${criterion}`)}</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-bob-brand"
                style={{ width: `${(rubric[criterion] / 5) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right font-semibold">{rubric[criterion]}/5</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
