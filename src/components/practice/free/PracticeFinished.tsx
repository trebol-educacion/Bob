import React from 'react';
import { RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/Button';
import type { PracticeRubricDetail } from '@/lib/practice/types';

export interface PracticeFinishedLabels {
  title: string;
  scoreLabel: string;
  again: string;
  home: string;
  criteria: Record<keyof PracticeRubricDetail, string>;
}

export interface PracticeFinishedProps {
  score: number;
  detail: PracticeRubricDetail;
  feedback: string;
  labels: PracticeFinishedLabels;
  onRestart: () => void;
  onExit: () => void;
}

export function PracticeFinished({ score, detail, feedback, labels, onRestart, onExit }: PracticeFinishedProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-6">
      <div className="space-y-1">
        <p className="text-sm font-bold uppercase tracking-widest text-gray-400">{labels.title}</p>
        <p className="text-6xl font-black" style={{ color: 'var(--color-bob-brand)' }}>
          {score.toFixed(1)}
          <span className="text-2xl text-gray-300">/10</span>
        </p>
        <p className="text-xs text-gray-400">{labels.scoreLabel}</p>
      </div>

      <p className="max-w-sm text-sm font-medium text-gray-600 italic">&quot;{feedback}&quot;</p>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        {(Object.keys(detail) as Array<keyof PracticeRubricDetail>).map((key) => (
          <div key={key} className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{labels.criteria[key]}</p>
            <p className="text-lg font-black text-trebol-text">{detail[key].toFixed(1)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={onRestart} className="flex items-center gap-2">
          <RotateCcw size={16} />
          {labels.again}
        </Button>
        <Button variant="primary" onClick={onExit} className="flex items-center gap-2">
          <Home size={16} />
          {labels.home}
        </Button>
      </div>
    </div>
  );
}
