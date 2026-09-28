'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle, Compass, Image as ImageIcon } from 'lucide-react';
import { BobHeading } from '@/components/choice/BobHeading';
import { ChoiceCard, type ChoiceCardTheme } from '@/components/choice/ChoiceCard';
import type { PracticeActivityMode } from '@/lib/practice/types';

export interface PracticeModeSelectViewProps {
  onSelectMode: (mode: PracticeActivityMode) => void;
}

type ModeTheme = ChoiceCardTheme & {
  mode: PracticeActivityMode;
  icon: React.ComponentType<{ className?: string }>;
};

const MODE_THEMES: ModeTheme[] = [
  {
    mode: 'conversation',
    icon: MessageCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100',
  },
  {
    mode: 'situation',
    icon: Compass,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-100',
  },
  {
    mode: 'picture',
    icon: ImageIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-100',
  },
];

/** @param props PracticeModeSelectViewProps */
export function PracticeModeSelectView({ onSelectMode }: PracticeModeSelectViewProps) {
  const t = useTranslations('practice.modeSelect');

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-10 px-4">
      <BobHeading size="md" className="max-w-2xl" title={t('heading')} subtitle={t('subtitle')} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl">
        {MODE_THEMES.map((theme, index) => (
          <ChoiceCard
            key={theme.mode}
            theme={theme}
            icon={theme.icon}
            title={t(`${theme.mode}.title`)}
            subtitle={t(`${theme.mode}.subtitle`)}
            index={index}
            onClick={() => onSelectMode(theme.mode)}
          />
        ))}
      </div>
    </div>
  );
}
