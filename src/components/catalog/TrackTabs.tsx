'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { PracticeTrack } from '@/lib/modes';

export interface TrackTabsProps {
  track: PracticeTrack;
  onChange: (track: PracticeTrack) => void;
}

export function TrackTabs({ track, onChange }: TrackTabsProps) {
  const t = useTranslations('mode_ui.track');

  const tabs: { key: PracticeTrack; label: string }[] = [
    { key: 'official', label: t('official') },
    { key: 'free', label: t('free') },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1">
      {tabs.map((tab) => {
        const active = tab.key === track;
        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
              active ? 'bg-white text-bob-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
