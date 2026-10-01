import React from 'react';
import { useTranslations } from 'next-intl';
import type { FCEGroupedItem, FCEGroupedItemResult } from '@/lib/reading/fce-grouped-types';
import type { GroupedBodyProps } from './types';

const GAP_PATTERN = /_{3,}/;

interface KeyWordCardProps {
  item: FCEGroupedItem;
  value: string;
  onChange: (value: string) => void;
  result: FCEGroupedItemResult | undefined;
}

function KeyWordCard({ item, value, onChange, result }: KeyWordCardProps) {
  const t = useTranslations('cambridge');
  const [before, after] = (item.sentenceWithGap ?? '').split(GAP_PATTERN);
  const border = !result ? 'border-gray-100' : result.isCorrect ? 'border-green-300' : 'border-red-300';

  return (
    <div className={`rounded-xl border bg-white shadow-sm p-4 space-y-3 ${border}`}>
      <div className="flex items-start gap-2">
        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center shrink-0">
          {item.number}
        </span>
        <p className="text-sm text-gray-800 leading-relaxed">{item.prompt}</p>
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
        {t('fce.grouped.keywordLabel')}:{' '}
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">{item.keyword}</span>
      </p>
      <p className="text-sm text-gray-800 leading-relaxed">
        {before}
        <input
          type="text"
          value={value}
          disabled={result !== undefined}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          aria-label={t('fce.grouped.gapLabel', { number: item.number })}
          className="mx-1 w-56 max-w-full border-0 border-b-2 border-gray-300 bg-transparent px-1 text-base focus:border-emerald-500 focus:outline-none"
        />
        {after}
      </p>
      {result && (
        <p className={`text-xs font-semibold ${result.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
          {result.isCorrect ? t('fce.grouped.correctBadge') : t('fce.grouped.incorrectBadge')}
          {!result.isCorrect && (
            <>
              {' · '}
              {t('fce.grouped.correctAnswerLabel')} <strong>{result.expected}</strong>
            </>
          )}
        </p>
      )}
    </div>
  );
}

export function KeyWordBody({ exercise, answers, onAnswer, results }: GroupedBodyProps) {
  const t = useTranslations('cambridge');
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">{t('fce.grouped.keywordHint')}</p>
      {exercise.items.map((item) => (
        <KeyWordCard
          key={item.number}
          item={item}
          value={answers[item.number] ?? ''}
          onChange={(value) => onAnswer(item.number, value)}
          result={results?.find((r) => r.number === item.number)}
        />
      ))}
    </div>
  );
}
