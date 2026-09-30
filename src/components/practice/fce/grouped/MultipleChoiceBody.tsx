import React from 'react';
import { useTranslations } from 'next-intl';
import type { FCEGroupedItem, FCEGroupedItemResult } from '@/lib/reading/fce-grouped-types';
import type { GroupedBodyProps } from './types';

interface QuestionCardProps {
  item: FCEGroupedItem;
  selected: string | undefined;
  onSelect: (key: string) => void;
  result: FCEGroupedItemResult | undefined;
}

function optionStyle(key: string, selected: string | undefined, result: FCEGroupedItemResult | undefined): string {
  if (result) {
    if (key === result.expected) return 'border-green-400 bg-green-50 text-gray-800';
    if (key === selected) return 'border-red-300 bg-red-50 text-gray-700';
    return 'border-gray-100 bg-gray-50 text-gray-500';
  }
  return key === selected
    ? 'border-emerald-400 bg-emerald-50 text-gray-800'
    : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-emerald-200 hover:bg-emerald-50/40';
}

function QuestionCard({ item, selected, onSelect, result }: QuestionCardProps) {
  const t = useTranslations('cambridge');
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 space-y-3">
      <div className="flex items-start gap-2">
        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center shrink-0">
          {item.number}
        </span>
        <p className="text-sm font-semibold text-gray-800 leading-snug">{item.prompt}</p>
      </div>
      <div className="space-y-2">
        {(item.options ?? []).map((option) => (
          <button
            key={option.key}
            type="button"
            disabled={result !== undefined}
            onClick={() => onSelect(option.key)}
            className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors cursor-pointer disabled:cursor-default ${optionStyle(option.key, selected, result)}`}
          >
            <span className="shrink-0 w-5 h-5 rounded-full border border-gray-300 bg-white text-[11px] font-bold text-gray-500 flex items-center justify-center">
              {option.key}
            </span>
            <span className="leading-snug">{option.label}</span>
          </button>
        ))}
      </div>
      {result && (
        <p className={`text-xs font-semibold ${result.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
          {result.isCorrect
            ? t('fce.grouped.correctBadge')
            : `${t('fce.grouped.incorrectBadge')} · ${t('fce.grouped.correctAnswerLabel')} ${result.expected}`}
        </p>
      )}
    </div>
  );
}

export function MultipleChoiceBody({ exercise, answers, onAnswer, results }: GroupedBodyProps) {
  return (
    <>
      <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-1">
          <p className="text-sm font-bold text-gray-800">{exercise.title}</p>
        </div>
        <div className="px-4 pb-4 pt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {exercise.text}
        </div>
      </div>
      <div className="space-y-3">
        {exercise.items.map((item) => (
          <QuestionCard
            key={item.number}
            item={item}
            selected={answers[item.number]}
            onSelect={(key) => onAnswer(item.number, key)}
            result={results?.find((r) => r.number === item.number)}
          />
        ))}
      </div>
    </>
  );
}
