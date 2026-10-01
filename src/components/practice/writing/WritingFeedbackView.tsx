'use client';

import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { InfoCard } from '@/components/chat';
import { FceScoreCard, ScoreHeadline } from '@/components/practice/writing/FceScoreCard';
import type { WritingFormativeFeedback } from '@/lib/types/practice';

export interface WritingFeedbackViewProps {
  feedback: WritingFormativeFeedback;
}

export function WritingFeedbackView({ feedback }: WritingFeedbackViewProps) {
  const t = useTranslations('resultcard');
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex flex-col gap-5 max-w-xl mx-auto w-full py-4"
    >
      <div className="flex items-center gap-2">
        <CheckCircle size={20} className="text-green-500 shrink-0" />
        <span className="text-sm font-semibold text-gray-700">
          <ScoreHeadline score10={feedback.score_10} fallback={feedback.understood ? t('wellDone') : t('submitted')} />
        </span>
      </div>

      {feedback.score_10 !== undefined && feedback.fce_rubric && (
        <FceScoreCard score10={feedback.score_10} rubric={feedback.fce_rubric} />
      )}

      {feedback.highlights.length > 0 && (
        <InfoCard title={t('highlights')}>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            {feedback.highlights.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </InfoCard>
      )}

      {feedback.suggestions.length > 0 && (
        <InfoCard title={t('toImprove')}>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            {feedback.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </InfoCard>
      )}

      {feedback.model_answer && (
        <InfoCard title={t('modelAnswer')}>
          <p className="text-sm text-gray-700 whitespace-pre-line">{feedback.model_answer}</p>
        </InfoCard>
      )}

      <div className="flex gap-4 text-sm text-gray-500">
        <span>{t('words')} <strong>{feedback.indicators.word_count}</strong></span>
        <span>{t('target')} <strong>{feedback.indicators.target_word_count_range[0]}-{feedback.indicators.target_word_count_range[1]}</strong></span>
      </div>

      {(feedback.indicators.covered_bullets?.length ?? 0) > 0 && (
        <div className="text-sm text-green-700">
          {t('covered')} {feedback.indicators.covered_bullets!.join(', ')}
        </div>
      )}
      {(feedback.indicators.missing_bullets?.length ?? 0) > 0 && (
        <div className="text-sm text-amber-700">
          {t('missing')} {feedback.indicators.missing_bullets!.join(', ')}
        </div>
      )}
    </motion.div>
  );
}
