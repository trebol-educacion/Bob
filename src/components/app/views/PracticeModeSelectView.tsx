'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle, Compass, Image as ImageIcon } from 'lucide-react';
import type { PracticeActivityMode } from '@/lib/practice/types';

export interface PracticeModeSelectViewProps {
  onSelectMode: (mode: PracticeActivityMode) => void;
}

const MODE_ICONS: Record<PracticeActivityMode, React.ComponentType<{ size?: number; className?: string }>> = {
  conversation: MessageCircle,
  situation: Compass,
  picture: ImageIcon,
};

const MODES: PracticeActivityMode[] = ['conversation', 'situation', 'picture'];

/** @param props PracticeModeSelectViewProps */
export function PracticeModeSelectView({ onSelectMode }: PracticeModeSelectViewProps) {
  const t = useTranslations('practice.modeSelect');

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-16 px-4">
      <div className="max-w-2xl w-full text-center mb-8 space-y-2">
        <p className="text-2xl font-black text-trebol-text">{t('heading')}</p>
        <p className="text-sm text-trebol-text opacity-60">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl">
        {MODES.map((m) => {
          const Icon = MODE_ICONS[m];
          return (
            <button
              key={m}
              onClick={() => onSelectMode(m)}
              className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-6 space-y-3"
            >
              <Icon size={28} className="text-trebol-text opacity-70" />
              <p className="text-lg font-black text-trebol-text">{t(`${m}.title`)}</p>
              <p className="text-sm text-trebol-text opacity-60">{t(`${m}.subtitle`)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
