import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ClozeGap, ClozeGapResult } from '@/actions/modes/fce-reading-part1';

export function GapRow({
  gap,
  selected,
  onSelect,
  disabled,
}: {
  gap: ClozeGap;
  selected: 'A' | 'B' | 'C' | 'D' | undefined;
  onSelect: (id: 'A' | 'B' | 'C' | 'D') => void;
  disabled: boolean;
}) {
  const t = useTranslations('cambridge');
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: gap.number * 0.05 }}
      className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center shrink-0">
          {gap.number}
        </span>
        <span className="text-xs font-semibold text-gray-500">
          {t('fce.cloze.gapLabel', { number: gap.number })}
        </span>
      </div>

      <div className="px-3 pb-3 grid grid-cols-2 gap-2">
        {gap.options.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(opt.id as 'A' | 'B' | 'C' | 'D')}
              className={[
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                isSelected
                  ? 'border-emerald-400 bg-emerald-50 text-gray-800'
                  : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-emerald-200 hover:bg-emerald-50/40',
                disabled ? 'cursor-not-allowed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                className={[
                  'shrink-0 w-5 h-5 rounded-full border text-[11px] font-bold flex items-center justify-center',
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-gray-300 bg-white text-gray-500',
                ].join(' ')}
              >
                {opt.id}
              </span>
              <span className="leading-snug truncate">{opt.text}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

export function GapResultRow({
  gap,
  result,
  animate,
}: {
  gap: ClozeGap;
  result: ClozeGapResult;
  animate: boolean;
}) {
  const t = useTranslations('cambridge');
  const correctOption = gap.options.find((o) => o.id === result.correct_option);
  const correctText = correctOption?.text ?? result.correct_option;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: gap.number * 0.06 }}
      className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center shrink-0">
          {gap.number}
        </span>
        <span className="text-xs font-semibold text-gray-500 flex-1">
          {t('fce.cloze.gapLabel', { number: gap.number })}
        </span>
        {result.isCorrect ? (
          <span className="flex items-center gap-1 text-[11px] font-bold text-green-600">
            <CheckCircle size={13} /> {t('fce.cloze.correctBadge')}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-bold text-red-500">
            <XCircle size={13} /> {t('fce.cloze.incorrectBadge')}
          </span>
        )}
      </div>

      <div className="px-3 pb-3 grid grid-cols-2 gap-2">
        {gap.options.map((opt) => {
          const isChosen = result.chosen === opt.id;
          const isCorrectOpt = opt.id === result.correct_option;
          const showGreen = isCorrectOpt;
          const showRed = isChosen && !result.isCorrect;

          return (
            <div
              key={opt.id}
              className={[
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                showGreen ? 'border-green-300 bg-green-50' : '',
                showRed ? 'border-red-300 bg-red-50' : '',
                !showGreen && !showRed ? 'border-gray-100 bg-gray-50 opacity-50' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                className={[
                  'shrink-0 w-5 h-5 rounded-full border text-[11px] font-bold flex items-center justify-center',
                  showGreen ? 'border-green-500 bg-green-500 text-white' : '',
                  showRed ? 'border-red-400 bg-red-400 text-white' : '',
                  !showGreen && !showRed ? 'border-gray-300 bg-white text-gray-400' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {opt.id}
              </span>
              <span
                className={
                  showGreen ? 'text-green-800 truncate' : showRed ? 'text-red-700 truncate' : 'text-gray-400 truncate'
                }
              >
                {opt.text}
              </span>
              {showGreen && <CheckCircle size={13} className="text-green-500 shrink-0 ml-auto" />}
              {showRed && <XCircle size={13} className="text-red-400 shrink-0 ml-auto" />}
            </div>
          );
        })}
      </div>

      {!result.isCorrect && (
        <div className="px-3 pb-2 text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{t('fce.cloze.correctAnswerLabel')}</span>{' '}
          <span className="text-green-700 font-semibold">{correctText}</span>
        </div>
      )}

      <div className="px-3 pb-3 text-xs text-gray-500 leading-relaxed">
        <span className="font-semibold text-gray-700">{t('fce.cloze.explanationLabel')}</span>{' '}
        {result.explanation}
      </div>
    </motion.div>
  );
}
