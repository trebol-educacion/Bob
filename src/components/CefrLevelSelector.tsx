'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { CefrLevel } from '@/lib/types/practice';

const CEFR_OPTIONS: { value: CefrLevel; label: string; comingSoon?: boolean }[] = [
  { value: 'pre_a1', label: 'Pre-A1' },
  { value: 'a1', label: 'A1' },
  { value: 'a2', label: 'A2' },
  { value: 'b1', label: 'B1' },
  { value: 'b2', label: 'B2' },
  { value: 'c1', label: 'C1', comingSoon: true },
  { value: 'c2', label: 'C2', comingSoon: true },
];

const BRAND_COLOR = 'var(--color-bob-brand)';

interface CefrLevelSelectorProps {
  value: CefrLevel | null;
  onChange: (level: CefrLevel) => void;
  onClear?: () => void;
  disabled: boolean;
  locked: boolean;
}

export function CefrLevelSelector({ value, onChange, onClear, disabled, locked }: CefrLevelSelectorProps) {
  const t = useTranslations('common');
  const isDisabled = disabled || locked;
  const canClear = !isDisabled && value !== null && Boolean(onClear);

  return (
    <div className="inline-flex items-center gap-1.5 sm:gap-3 max-w-full">
      {canClear ? (
        <motion.button
          type="button"
          onClick={() => onClear?.()}
          title={t('level.clear')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="inline-flex items-center gap-1 sm:gap-1.5 shrink-0 rounded-full bg-trebol-text/5 hover:bg-trebol-text/10 px-2 py-1 sm:px-3 sm:py-1.5 text-[9px] sm:text-[11px] font-black uppercase tracking-[0.14em] sm:tracking-[0.18em] text-trebol-text/70 hover:text-trebol-text transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <polyline points="3 4 3 10 9 10" />
          </svg>
          {t('level.label')}
        </motion.button>
      ) : (
        <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.22em] text-trebol-text/55 shrink-0">
          {t('level.label')}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label="Nivel CEFR"
        title={locked ? t('level.lockedByOrg') : undefined}
        className="relative inline-flex items-center gap-0 sm:gap-0.5 rounded-full bg-white p-0.5 sm:p-1 border border-[#ece8de]"
        style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}
      >
        {CEFR_OPTIONS.map(({ value: v, label, comingSoon }) => {
          const isActive = value === v;
          const itemDisabled = (isDisabled && !isActive) || Boolean(comingSoon);
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={itemDisabled}
              title={comingSoon ? t('level.comingSoon') : undefined}
              onClick={() => !isDisabled && !comingSoon && onChange(v)}
              className="relative whitespace-nowrap px-1.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed"
              style={{
                color: isActive
                  ? '#fff'
                  : itemDisabled
                    ? 'rgba(45,55,72,0.25)'
                    : BRAND_COLOR,
                opacity: !isActive && !itemDisabled ? 0.75 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isActive && !itemDisabled) {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive && !itemDisabled) {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '0.75';
                }
              }}
            >
              {isActive && (
                <motion.span
                  layoutId="cefr-active"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: BRAND_COLOR,
                    boxShadow: `0 2px 8px -2px color-mix(in oklab, ${BRAND_COLOR} 50%, transparent)`,
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative tabular-nums tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
      {locked && (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold text-trebol-text/45"
          aria-label={t('level.lockedAria')}
          title={t('level.lockedAria')}
        >
          <Lock size={11} strokeWidth={2.2} />
        </span>
      )}
    </div>
  );
}
