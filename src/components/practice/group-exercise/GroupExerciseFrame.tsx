'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { ActivityErrorState } from '@/components/activity/ActivityErrorState';
import { ActivityHeader } from '@/components/activity/ActivityHeader';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { useActivityPresentation } from '@/hooks/useActivityPresentation';
import { partLabel } from '@/lib/activity/part-label';
import type { ChoiceGroupController } from './types';

export interface GroupExerciseFrameProps {
  controller: ChoiceGroupController;
  examPart: string;
  title: string;
  subtitle: string;
  onBack: () => void;
  onOpenDashboard?: () => void;
  children: React.ReactNode;
}

export function GroupExerciseFrame({ controller, examPart, title, subtitle, onBack, onOpenDashboard, children }: GroupExerciseFrameProps) {
  const presentation = useActivityPresentation(examPart);
  const header = (
    <ActivityHeader
      title={presentation?.title ?? title}
      subtitle={presentation?.description ?? subtitle}
      badge={partLabel(examPart)}
      onBack={onBack}
    />
  );
  const { phase, exercise, answers, result, errorMessage, isNewSession, submit, retry } = controller;
  const answeredCount = Object.values(answers).filter((value) => value.trim() !== '').length;

  if (phase === 'loading' || phase === 'submitting') {
    return (
      <div className="flex flex-col h-full">
        {header}
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={phase === 'loading' ? 'Loading your exercise…' : 'Checking your answers…'} />
        </div>
      </div>
    );
  }

  if (phase === 'error' || !exercise) {
    return (
      <div className="flex flex-col h-full">
        {header}
        <ActivityErrorState message={errorMessage} onRetry={retry} onBack={onBack} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {header}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {children}
          {phase === 'finished' && result && (
            <div className="flex flex-col items-center gap-2 pt-2 pb-6">
              <p className="text-sm font-bold text-gray-700" data-testid="score-10">
                Score: {result.score_10} / 10
              </p>
              <CelebrationCard
                score={result.correct}
                scoreMax={result.total}
                onAction={onOpenDashboard}
                actionLabel="Go to dashboard"
                animate={isNewSession}
              />
            </div>
          )}
        </div>
      </div>
      {phase === 'ready' && (
        <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 max-w-3xl mx-auto w-full">
          {errorMessage && <p role="alert" className="text-xs text-red-600 mb-2 text-center">{errorMessage}</p>}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={answeredCount === 0}
            className={[
              'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition w-full justify-center',
              answeredCount > 0 ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed',
            ].join(' ')}
          >
            Submit answers ({answeredCount}/{exercise.questions.length})
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
