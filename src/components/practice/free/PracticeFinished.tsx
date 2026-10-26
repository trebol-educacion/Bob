import React from 'react';
import { RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/Button';
import { isCriteriaDetail, type PracticeCriteriaRubricDetail, type PracticeRubricDetail } from '@/lib/practice/types';

const CRITERIA_ORDER: ReadonlyArray<keyof PracticeCriteriaRubricDetail> = ['pronunciation', 'fluency', 'grammar', 'vocabulary'];
const BAR_MAX = 10;

export interface PracticeFinishedLabels {
  title: string;
  scoreLabel: string;
  again: string;
  home: string;
  notRated: string;
  criteria: Record<string, string>;
}

export interface PracticeFinishedProps {
  score: number;
  detail: PracticeRubricDetail;
  feedback: string;
  labels: PracticeFinishedLabels;
  onRestart: () => void;
  onExit: () => void;
}

function CriteriaBars({ detail, labels }: { detail: PracticeCriteriaRubricDetail; labels: PracticeFinishedLabels }) {
  return (
    <ul className="w-full max-w-xs space-y-3 text-left">
      {CRITERIA_ORDER.map((key) => {
        const value = detail[key];
        return (
          <li key={key}>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">{labels.criteria[key]}</span>
              <span className="text-sm font-black text-trebol-text">{value === null ? labels.notRated : value.toFixed(1)}</span>
            </div>
            <div
              className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden"
              role="progressbar"
              aria-label={labels.criteria[key]}
              aria-valuemin={0}
              aria-valuemax={BAR_MAX}
              aria-valuenow={value ?? undefined}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${((value ?? 0) / BAR_MAX) * 100}%`, background: 'var(--color-bob-brand)' }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function LegacyTiles({ detail, labels }: { detail: Record<string, number | null>; labels: PracticeFinishedLabels }) {
  return (
    <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
      {Object.keys(detail).map((key) => (
        <div key={key} className="bg-gray-50 rounded-xl px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{labels.criteria[key]}</p>
          <p className="text-lg font-black text-trebol-text">{(detail[key] ?? 0).toFixed(1)}</p>
        </div>
      ))}
    </div>
  );
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

      {isCriteriaDetail(detail) ? (
        <CriteriaBars detail={detail} labels={labels} />
      ) : (
        <LegacyTiles detail={{ ...detail }} labels={labels} />
      )}

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
