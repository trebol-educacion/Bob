'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { GraduationCap, Sparkles } from 'lucide-react';
import { BobHeading } from '@/components/choice/BobHeading';
import { ChoiceCard, type ChoiceCardTheme } from '@/components/choice/ChoiceCard';
import type { Organization } from '@/lib/organization';
import type { CefrLevel } from '@/lib/types/practice';

export interface HomeViewProps {
  organization: Organization | null;
  cefrActiveLevel: CefrLevel | null;
  onSelectExam: () => void;
  onSelectPractice: () => void;
}

const EXAM_THEME: ChoiceCardTheme = {
  color: 'text-amber-600',
  bgColor: 'bg-amber-50',
  borderColor: 'border-amber-100',
};

const PRACTICE_THEME: ChoiceCardTheme = {
  color: 'text-blue-600',
  bgColor: 'bg-blue-50',
  borderColor: 'border-blue-100',
};

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
    <div className="w-full flex-1 flex flex-col items-center justify-center py-10 px-4">
      <BobHeading size="md" className="max-w-2xl" title={tp('heading')} subtitle={tp('subtitle')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
        <ChoiceCard
          theme={EXAM_THEME}
          icon={GraduationCap}
          title={tp('exam.title')}
          subtitle={tp('exam.subtitle')}
          index={0}
          onClick={onSelectExam}
        >
          {cefrActiveLevel && (
            <span className={`text-xs font-bold tracking-wide ${EXAM_THEME.color}`}>
              {tp('exam.level', { level: cefrActiveLevel.toUpperCase() })}
            </span>
          )}
        </ChoiceCard>

        <ChoiceCard
          theme={PRACTICE_THEME}
          icon={Sparkles}
          title={tp('practice.title')}
          subtitle={tp('practice.subtitle')}
          index={1}
          onClick={onSelectPractice}
        />
      </div>
    </div>
  );
}
