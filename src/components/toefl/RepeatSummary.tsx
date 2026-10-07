'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { MessageBubble, InfoCard } from '@/components/chat';
import type { RepetitionObjectiveFeedback } from '@/lib/types/practice';
import type { ToeflRepeatItem } from '@/lib/toefl/repeat';

export interface RepeatSummaryProps {
  results: Array<{ item: ToeflRepeatItem; evaluation: RepetitionObjectiveFeedback }>;
  onRestart: () => void;
  onBack: () => void;
}

/** End-of-session summary of TOEFL Listen and Repeat. */
export function RepeatSummary({ results, onRestart, onBack }: RepeatSummaryProps) {
  const t = useTranslations('toefl');
  const exactCount = results.filter((r) => r.evaluation.exact_repetition).length;
  return (
    <div className="flex flex-col gap-6">
      <MessageBubble variant="assistant" accentColor="blue">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('listenRepeat.finished.sessionComplete')}</p>
        <p className="text-4xl font-black text-bob-brand">{exactCount} / {results.length}</p>
        <p className="text-sm font-bold text-gray-400 mt-1">{t('listenRepeat.finished.exactRepetitions')}</p>
      </MessageBubble>

      <InfoCard title={t('listenRepeat.finished.itemBreakdown')}>
        <div className="grid grid-cols-5 gap-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded-xl border-2 p-2 text-center ${r.evaluation.exact_repetition ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}
              title={r.item.text}
            >
              <p className="text-xs text-gray-400 font-semibold">{i + 1}</p>
              <p className={`text-lg font-black ${r.evaluation.exact_repetition ? 'text-green-600' : 'text-amber-500'}`}>
                {r.evaluation.exact_repetition ? '✓' : '~'}
              </p>
            </div>
          ))}
        </div>
      </InfoCard>

      <div className="flex gap-3">
        <button
          onClick={onRestart}
          className="flex-1 border-2 border-gray-200 hover:border-gray-400 text-gray-700 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw size={16} />
          {t('common.tryAgain')}
        </button>
        <button
          onClick={onBack}
          className="flex-1 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          style={{ background: 'var(--color-bob-brand)' }}
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>
      </div>
    </div>

  );
}
