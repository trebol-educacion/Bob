'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { FCEReadingIcon } from '@/components/icons/FCEIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import type { StoredMessage } from '@/actions/messages';
import { FCE_GROUPED_ANSWER_KIND, type FCEGroupedPart } from '@/lib/reading/fce-grouped-types';
import { GapTextBody } from './GapTextBody';
import { KeyWordBody } from './KeyWordBody';
import { MultipleChoiceBody } from './MultipleChoiceBody';
import { useGroupExercise } from '@/components/practice/group-exercise/useGroupExercise';
import { GROUPED_API_BY_PART } from './api';
import type { GroupedBodyProps } from './types';

export interface FCEGroupedReadingPracticeProps {
  part: FCEGroupedPart;
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

const BODY_BY_KIND = {
  open: GapTextBody,
  sentence: GapTextBody,
  'key-word': KeyWordBody,
  choice: MultipleChoiceBody,
} as const satisfies Record<string, React.ComponentType<GroupedBodyProps>>;

export function FCEGroupedReadingPractice({
  part,
  onBack,
  sessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: FCEGroupedReadingPracticeProps) {
  const t = useTranslations('cambridge');
  const state = useGroupExercise({
    api: GROUPED_API_BY_PART[part],
    sessionId,
    initialMessages,
    onSessionCreated,
    onSessionFinished,
  });
  const { phase, exercise, answers, result: score } = state;
  const results = score?.results ?? null;
  const Body = BODY_BY_KIND[FCE_GROUPED_ANSWER_KIND[part]];
  const answeredCount = Object.values(answers).filter((value) => value.trim() !== '').length;
  const total = exercise?.items.length ?? 0;

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          aria-label={t('fce.grouped.back')}
        >
          ←
        </button>
        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <FCEReadingIcon size={18} className="text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{t(`fce.grouped.parts.${part}.title`)}</p>
          <p className="text-xs text-gray-400">{t(`fce.grouped.parts.${part}.subtitle`)}</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
          {t(`fce.grouped.parts.${part}.badge`)}
        </span>
      </div>

      {phase === 'loading' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('fce.grouped.preparingExercise')} />
        </div>
      )}

      {phase === 'submitting' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('fce.grouped.checkingAnswers')} />
        </div>
      )}

      {phase === 'error' && (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
          <p className="text-red-500 font-semibold">{state.errorMessage}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={state.retry}
              className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors text-sm cursor-pointer"
            >
              {t('fce.grouped.retry')}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm cursor-pointer"
            >
              {t('fce.grouped.back')}
            </button>
          </div>
        </div>
      )}

      {(phase === 'ready' || phase === 'finished') && exercise && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">{t(`fce.grouped.parts.${part}.instructions`)}</p>
          <Body exercise={exercise} answers={answers} onAnswer={state.setAnswer} results={results} />
          {phase === 'finished' && score && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-sm font-bold text-gray-800">
                {t('fce.grouped.markLabel', { score: score.score10 })}
              </p>
              <CelebrationCard
                score={score.correct}
                scoreMax={score.total}
                feedback={t('fce.grouped.celebrationFeedback')}
                onAction={onOpenDashboard}
                actionLabel={t('fce.grouped.celebrationAction')}
                animate={state.isNewSession}
              />
            </div>
          )}
          <div className="h-20" />
        </div>
      )}

      {phase === 'ready' && (
        <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
          {state.errorMessage && (
            <p role="alert" className="text-xs text-red-600 flex-1">
              {state.errorMessage}
            </p>
          )}
          <p className="text-xs text-gray-400 flex-1">
            {t('fce.grouped.answeredCount', { answered: answeredCount, total })}
          </p>
          <button
            type="button"
            onClick={state.submit}
            disabled={answeredCount < total || total === 0}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {t('fce.grouped.submitAnswers')}
          </button>
        </div>
      )}
    </div>
  );
}
