'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { GraduationCap, Sparkles } from 'lucide-react';
import type { Organization } from '@/lib/organization';
import type { CefrLevel } from '@/lib/types/practice';

export interface HomeViewProps {
  organization: Organization | null;
  cefrActiveLevel: CefrLevel | null;
  onSelectExam: () => void;
  onSelectPractice: () => void;
}

/** @param props HomeViewProps */
export function HomeView({ organization, cefrActiveLevel, onSelectExam, onSelectPractice }: HomeViewProps) {
  const t = useTranslations('home.bobUnavailable');
  const tp = useTranslations('practice.home');

  if (organization && organization.is_bob_enabled === false) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="bg-white shadow-md rounded-2xl p-10 max-w-md w-full space-y-3">
          <p className="text-2xl font-black text-trebol-text">{t('title')}</p>
          <p className="text-trebol-text opacity-60 font-medium text-sm">{t('body')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-16 px-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
        <button
          onClick={onSelectExam}
          className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-6 space-y-3"
        >
          <GraduationCap size={28} className="text-trebol-text opacity-70" />
          <p className="text-xl font-black text-trebol-text">{tp('exam.title')}</p>
          <p className="text-sm text-trebol-text opacity-60">{tp('exam.subtitle')}</p>
          {cefrActiveLevel && (
            <p className="text-xs font-bold uppercase tracking-wide text-trebol-text opacity-40">
              {tp('exam.level', { level: cefrActiveLevel.toUpperCase() })}
            </p>
          )}
        </button>

        <button
          onClick={onSelectPractice}
          className="text-left rounded-2xl shadow-sm hover:shadow-md transition-shadow p-6 space-y-3 text-white"
          style={{ background: 'var(--color-bob-brand)' }}
        >
          <Sparkles size={28} className="opacity-90" />
          <p className="text-xl font-black">{tp('practice.title')}</p>
          <p className="text-sm opacity-90">{tp('practice.subtitle')}</p>
        </button>
      </div>
    </div>
  );
}
