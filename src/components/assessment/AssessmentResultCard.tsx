'use client';

import React from 'react';
import { CheckCircle2, Lightbulb, ChevronRight } from 'lucide-react';
import type { AssessmentResult } from '@/lib/types/skills';

interface Props {
  result: AssessmentResult;
  onPracticeNow: () => void;
}

const BAND_LABELS: Record<string, string> = {
  pre_a1: 'Pre-A1',
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
};

const BAND_COLORS: Record<string, string> = {
  pre_a1: 'bg-gray-100 text-gray-600',
  a1:     'bg-blue-50 text-blue-700',
  a2:     'bg-sky-100 text-sky-700',
  b1:     'bg-emerald-50 text-emerald-700',
  b2:     'bg-teal-100 text-teal-700',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  low:    'low confidence',
  medium: 'medium confidence',
  high:   'high confidence',
};

const SKILL_LABELS: Record<string, string> = {
  speaking: 'Speaking',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
};

export function AssessmentResultCard({ result, onPracticeNow }: Props) {
  const bandLabel = BAND_LABELS[result.cefr_band] ?? result.cefr_band.toUpperCase();
  const bandColor = BAND_COLORS[result.cefr_band] ?? 'bg-gray-100 text-gray-600';
  const confidenceLabel = CONFIDENCE_LABELS[result.confidence] ?? result.confidence;
  const skillLabel = SKILL_LABELS[result.skill] ?? result.skill;

  const feedback = result.feedback;
  const highlights = 'highlights' in feedback ? feedback.highlights : ('strengths' in feedback ? (feedback as { strengths: string[] }).strengths : []);
  const suggestions = 'suggestions' in feedback ? feedback.suggestions : ('improvements' in feedback ? (feedback as { improvements: string[] }).improvements : []);
  const overallMessage = 'overall_message' in feedback ? feedback.overall_message : ('next_step' in feedback ? (feedback as { next_step: string }).next_step : null);

  const isScored = result.skill === 'listening' || result.skill === 'reading';
  const score = isScored ? (result as { score: number }).score : null;
  const scoreMax = isScored ? (result as { score_max: number }).score_max : null;

  const isWriting = result.skill === 'writing';
  const bulletsCovered = isWriting ? (result as { bullets_covered: number }).bullets_covered : null;
  const totalBullets = isWriting ? 4 : null;

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 max-w-lg mx-auto w-full gap-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7 w-full flex flex-col gap-5">

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Your estimated {skillLabel} level
          </p>
          <span className={`px-4 py-1.5 rounded-full text-2xl font-black ${bandColor}`}>
            {bandLabel}
          </span>
          <span className="text-xs text-gray-400 font-medium">{confidenceLabel}</span>
          {score !== null && scoreMax !== null && (
            <span className="text-sm font-semibold text-gray-600 mt-1">
              {score} / {scoreMax} correct
            </span>
          )}
          {bulletsCovered !== null && totalBullets !== null && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mt-1">
              {bulletsCovered}/{totalBullets} task points covered
            </span>
          )}
        </div>

        {overallMessage && (
          <p className="text-sm text-gray-600 text-center leading-relaxed">
            {overallMessage}
          </p>
        )}

        {highlights.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-green-500" /> What went well
            </p>
            <ul className="flex flex-col gap-1.5 pl-1">
              {highlights.map((h, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <Lightbulb size={13} className="text-amber-500" /> To improve
            </p>
            <ul className="flex flex-col gap-1.5 pl-1">
              {suggestions.map((s, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 shrink-0">→</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        onClick={onPracticeNow}
        className="flex items-center gap-2 px-6 py-3 bg-trebol-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 transition shadow-sm w-full justify-center"
      >
        Practice now <ChevronRight size={16} />
      </button>
    </div>
  );
}
