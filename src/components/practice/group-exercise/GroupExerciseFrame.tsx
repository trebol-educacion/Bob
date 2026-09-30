'use client';

import React from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import type { GroupExerciseController } from './useGroupExercise';

export interface GroupExerciseFrameProps {
  controller: GroupExerciseController;
  title: string;
  subtitle: string;
  onBack: () => void;
  onOpenDashboard?: () => void;
  children: React.ReactNode;
}

function Header({ title, subtitle, onBack }: Pick<GroupExerciseFrameProps, 'title' | 'subtitle' | 'onBack'>) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
      <button
        type="button"
        onClick={onBack}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
        aria-label="Go back"
      >
        ←
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">{title}</p>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
      <span
        className="shrink-0 px-2 py-0.5 rounded-full text-indigo-600 text-[10px] font-bold uppercase tracking-widest"
        style={{ background: 'color-mix(in oklab, #6366f1 12%, white)' }}
      >
        B2 · FCE
      </span>
    </div>
  );
}

function ErrorState({ message, onRetry, onBack }: { message: string | null; onRetry: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
      <p className="text-lg font-bold text-gray-800">Something went wrong</p>
      <p className="text-sm text-gray-500 max-w-xs">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition cursor-pointer"
      >
        <RotateCcw size={16} />
        Try again
      </button>
      <button type="button" onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer">
        Go back
      </button>
    </div>
  );
}

export function GroupExerciseFrame({ controller, title, subtitle, onBack, onOpenDashboard, children }: GroupExerciseFrameProps) {
  const { phase, exercise, answers, result, errorMessage, isNewSession, submit, retry } = controller;
  const answeredCount = Object.values(answers).filter((value) => value.trim() !== '').length;

  if (phase === 'loading' || phase === 'submitting') {
    return (
      <div className="flex flex-col h-full">
        <Header title={title} subtitle={subtitle} onBack={onBack} />
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={phase === 'loading' ? 'Loading your exercise…' : 'Checking your answers…'} />
        </div>
      </div>
    );
  }

  if (phase === 'error' || !exercise) {
    return (
      <div className="flex flex-col h-full">
        <Header title={title} subtitle={subtitle} onBack={onBack} />
        <ErrorState message={errorMessage} onRetry={retry} onBack={onBack} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={title} subtitle={subtitle} onBack={onBack} />
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
                feedback="Keep practising to sharpen your B2 skills."
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
            Check answers ({answeredCount}/{exercise.questions.length})
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
