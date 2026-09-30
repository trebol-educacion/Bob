import React from 'react';
import { useTranslations } from 'next-intl';
import { GapText, SentenceBank, type GapReview } from '@/components/practice/gap-text';
import { FCE_GROUPED_ANSWER_KIND, type FCEGroupedItemResult } from '@/lib/reading/fce-grouped-types';
import type { GroupedBodyProps } from './types';

function buildReview(
  results: FCEGroupedItemResult[] | null,
  labelOf: (key: string) => string
): Record<number, GapReview> | undefined {
  if (!results) return undefined;
  const review: Record<number, GapReview> = {};
  for (const result of results) {
    review[result.number] = {
      isCorrect: result.isCorrect,
      given: result.given === '' ? '—' : labelOf(result.given),
      expected: labelOf(result.expected),
    };
  }
  return review;
}

export function GapTextBody({ exercise, answers, onAnswer, results }: GroupedBodyProps) {
  const t = useTranslations('cambridge');
  const isSentence = FCE_GROUPED_ANSWER_KIND[exercise.part] === 'sentence';
  const sentences = exercise.sentences.map((s) => ({ id: s.key, text: s.label }));
  const baseWords = Object.fromEntries(
    exercise.items.filter((item) => item.baseWord).map((item) => [item.number, item.baseWord as string])
  );
  const review = buildReview(results, (key) => key);

  return (
    <>
      <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-1">
          <p className="text-sm font-bold text-gray-800">{exercise.title}</p>
        </div>
        <div className="px-4 pb-4 pt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          <GapText
            text={exercise.text ?? ''}
            mode={isSentence ? 'sentence-bank' : 'input'}
            values={answers}
            onChange={onAnswer}
            review={review}
            baseWords={baseWords}
            sentences={sentences}
            gapLabel={(number) => t('fce.grouped.gapLabel', { number })}
          />
        </div>
      </div>
      {isSentence && (
        <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
            {t('fce.grouped.sentenceBankTitle')}
          </p>
          <SentenceBank sentences={sentences} usedIds={Object.values(answers)} />
        </div>
      )}
      {results && !isSentence && (
        <ul className="space-y-1 text-xs text-gray-500">
          {results
            .filter((r) => !r.isCorrect)
            .map((r) => (
              <li key={r.number}>
                {r.number}. {t('fce.grouped.correctAnswerLabel')} <strong>{r.expected}</strong>
              </li>
            ))}
        </ul>
      )}
    </>
  );
}
