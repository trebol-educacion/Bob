'use client';

import React from 'react';
import type { CefrLevel } from '@/lib/types/practice';

const CEFR_OPTIONS: { value: CefrLevel; label: string }[] = [
  { value: 'a1', label: 'A1' },
  { value: 'a2', label: 'A2' },
  { value: 'b1', label: 'B1' },
  { value: 'b2', label: 'B2' },
  { value: 'c1', label: 'C1' },
  { value: 'c2', label: 'C2' },
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
    <div className="flex items-center gap-3">
      <label className="text-sm font-semibold text-trebol-text/70 shrink-0">
        Nivel CEFR
      </label>
      <div className="relative" title={locked ? 'Tu colegio bloqueó tu nivel CEFR' : undefined}>
        <select
          value={value ?? ''}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value as CefrLevel);
          }}
          disabled={isDisabled}
          className={`
            appearance-none rounded-lg border border-trebol-border bg-white
            px-3 py-1.5 pr-8 text-sm font-semibold text-trebol-text
            focus:outline-none focus:ring-2 focus:ring-trebol-primary/40
            transition-colors
            ${isDisabled
              ? 'opacity-50 cursor-not-allowed bg-trebol-bg'
              : 'cursor-pointer hover:border-trebol-primary/50'
            }
          `}
        >
          <option value="" disabled>
            Selecciona nivel
          </option>
          {CEFR_OPTIONS.map(({ value: v, label }) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        {/* Chevron icon */}
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-trebol-text/40">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>
      {locked && (
        <span className="text-xs text-trebol-text/50 italic">
          Bloqueado por tu colegio
        </span>
      )}
    </div>
  );
}
