'use client';

import React from 'react';
import type { SpeakingCriterionAverage, SpeakingPoint } from '@/lib/stats/progress-summary';
import { hasCurve, layoutSeries, linePath } from '@/lib/stats/speaking-evolution';

export interface SpeakingEvolutionLabels {
  title: string;
  subtitle: string;
  empty: string;
  needMore: string;
  byCriterion: string;
  criteria: Record<string, string>;
  chartLabel: string;
}

export interface SpeakingEvolutionProps {
  series: SpeakingPoint[];
  criteria: SpeakingCriterionAverage[];
  labels: SpeakingEvolutionLabels;
}

const GEOMETRY = { width: 320, height: 140, padding: 16 };
const CRITERIA_ORDER = ['pronunciation', 'fluency', 'grammar', 'vocabulary'];
const GRID_LINES = [0, 5, 10];

function CriteriaBars({ criteria, labels }: { criteria: SpeakingCriterionAverage[]; labels: SpeakingEvolutionLabels }) {
  const ordered = CRITERIA_ORDER.flatMap((key) => criteria.filter((c) => c.criterion === key));
  if (ordered.length === 0) return null;
  return (
    <div className="mt-5">
      <h4 className="text-[11px] font-black uppercase tracking-wider text-trebol-text/50 mb-2">{labels.byCriterion}</h4>
      <ul className="grid gap-2">
        {ordered.map((c) => (
          <li key={c.criterion}>
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-bold text-trebol-text">{labels.criteria[c.criterion] ?? c.criterion}</span>
              <span className="text-[12px] font-black tabular-nums text-trebol-text/70">{c.avg.toFixed(1)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-trebol-text/10 overflow-hidden">
              <div className="h-full rounded-full bg-[#3660AB]" style={{ width: `${Math.min(100, (c.avg / 10) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** @param props SpeakingEvolutionProps */
export function SpeakingEvolution({ series, criteria, labels }: SpeakingEvolutionProps) {
  const points = layoutSeries(series, GEOMETRY);
  const curve = hasCurve(series);

  return (
    <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 mb-6">
      <div className="rounded-3xl border border-trebol-border/40 bg-white shadow-sm p-5">
        <h3 className="text-sm font-black text-trebol-text tracking-tight leading-tight">{labels.title}</h3>
        <p className="text-[11px] font-semibold text-trebol-text/50 mt-0.5">{labels.subtitle}</p>

        {series.length === 0 ? (
          <div className="h-[140px] grid place-items-center text-[12px] font-semibold text-trebol-text/40 text-center">
            {labels.empty}
          </div>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${GEOMETRY.width} ${GEOMETRY.height}`}
              className="w-full h-auto mt-3"
              role="img"
              aria-label={labels.chartLabel}
            >
              {GRID_LINES.map((value) => {
                const y = GEOMETRY.padding + (GEOMETRY.height - GEOMETRY.padding * 2) * (1 - value / 10);
                return (
                  <g key={value}>
                    <line x1={GEOMETRY.padding} x2={GEOMETRY.width - GEOMETRY.padding} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.1} />
                    <text x={2} y={y + 3} fontSize={8} fill="currentColor" fillOpacity={0.4}>{value}</text>
                  </g>
                );
              })}
              {curve && <path d={linePath(points)} fill="none" stroke="#3660AB" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
              {points.map((p) => (
                <circle key={p.at} cx={p.x} cy={p.y} r={3.5} fill="#3660AB">
                  <title>{p.score10.toFixed(1)}</title>
                </circle>
              ))}
            </svg>
            {!curve && <p className="mt-2 text-[11px] font-semibold text-trebol-text/50">{labels.needMore}</p>}
          </>
        )}

        <CriteriaBars criteria={criteria} labels={labels} />
      </div>
    </section>
  );
}
