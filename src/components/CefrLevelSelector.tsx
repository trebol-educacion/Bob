'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { motion } from 'motion/react';
import type { CefrLevel } from '@/lib/types/practice';

const CEFR_OPTIONS: { value: CefrLevel; label: string; color: string; soft: string }[] = [
  { value: 'a1', label: 'A1', color: '#469E7B', soft: '#dcebe3' },
  { value: 'a2', label: 'A2', color: '#3660AB', soft: '#dde4f2' },
  { value: 'b1', label: 'B1', color: '#F8AC37', soft: '#fde9c8' },
  { value: 'b2', label: 'B2', color: '#E62D2B', soft: '#fad6d5' },
  { value: 'c1', label: 'C1', color: '#1E1E1C', soft: '#e5e5e2' },
  { value: 'c2', label: 'C2', color: '#1E1E1C', soft: '#e5e5e2' },
];

interface CefrLevelSelectorProps {
  value: CefrLevel | null;
  onChange: (level: CefrLevel) => void;
  disabled: boolean;
  locked: boolean;
}

export function CefrLevelSelector({ value, onChange, disabled, locked }: CefrLevelSelectorProps) {
  const isDisabled = disabled || locked;

  return (
    <div className="inline-flex items-center gap-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-trebol-text/55 shrink-0">
        Nivel
      </span>
      <div
        role="radiogroup"
        aria-label="Nivel CEFR"
        title={locked ? 'Tu colegio bloqueó tu nivel CEFR' : undefined}
        className="relative inline-flex items-center gap-0.5 rounded-full bg-white p-1 border border-[#ece8de]"
        style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}
      >
        {CEFR_OPTIONS.map(({ value: v, label, color }) => {
          const isActive = value === v;
          const itemDisabled = isDisabled && !isActive;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={itemDisabled}
              onClick={() => !isDisabled && onChange(v)}
              className="relative px-3 py-1.5 text-xs font-bold rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed"
              style={{
                color: isActive
                  ? '#fff'
                  : itemDisabled
                    ? 'rgba(45,55,72,0.25)'
                    : color,
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
                    background: color,
                    boxShadow: `0 2px 8px -2px ${color}80`,
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
          aria-label="Bloqueado por tu colegio"
          title="Bloqueado por tu colegio"
        >
          <Lock size={11} strokeWidth={2.2} />
        </span>
      )}
    </div>
  );
}
