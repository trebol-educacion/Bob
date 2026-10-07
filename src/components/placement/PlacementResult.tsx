'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PlacementLevel } from '@/lib/placement/types';

export interface PlacementResultProps {
  skill: string;
  level: PlacementLevel | null;
  onContinue: () => void;
}

/** @param props PlacementResultProps */
export function PlacementResult({ skill, level, onContinue }: PlacementResultProps) {
  const t = useTranslations('placement.result');

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 bg-white">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="grid place-items-center w-20 h-20 rounded-full"
        style={{ background: 'radial-gradient(120% 120% at 50% 24%, #ffe79c, #ffc73a 80%)' }}
      >
        <Trophy size={36} color="#fff" fill="#fff" strokeWidth={2} />
      </motion.div>
      <h2 className="text-2xl font-black text-gray-800">{t('title')}</h2>
      {level && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-semibold text-gray-500">{t('levelLabel', { skill })}</p>
          <p className="text-5xl font-black text-bob-brand" data-testid="placement-result-level">
            {level.toUpperCase()}
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={onContinue}
        className="px-6 py-3 rounded-xl text-white text-sm font-bold shadow-sm cursor-pointer"
        style={{ background: 'var(--color-bob-brand)' }}
      >
        {t('continue')}
      </button>
    </div>
  );
}
