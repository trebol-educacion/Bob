'use client';

import React from 'react';

export interface ChoiceOptionsProps {
  options: Record<string, string>;
  chosen: string | null;
  correctKey?: string | null;
  accent: string;
  onChoose?: (key: string) => void;
}

function optionClass(key: string, chosen: string | null, correctKey: string | null | undefined): string {
  if (correctKey) {
    if (key === correctKey) return 'border-green-400 bg-green-50 text-green-800';
    if (key === chosen) return 'border-red-300 bg-red-50 text-red-700 line-through';
    return 'border-gray-100 text-gray-400';
  }
  return key === chosen ? 'text-white border-transparent' : 'border-gray-200 text-gray-700 hover:border-gray-300';
}

/** @param props ChoiceOptionsProps */
export function ChoiceOptions({ options, chosen, correctKey, accent, onChoose }: ChoiceOptionsProps) {
  return (
    <div className="grid gap-2">
      {Object.entries(options).map(([key, text]) => {
        const selected = !correctKey && key === chosen;
        return (
          <button
            key={key}
            type="button"
            disabled={!onChoose}
            onClick={() => onChoose?.(key)}
            aria-pressed={key === chosen}
            aria-label={`${key}. ${text}`}
            className={`flex items-center gap-3 text-left rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:cursor-default cursor-pointer ${optionClass(key, chosen, correctKey)}`}
            style={selected ? { background: accent } : undefined}
          >
            <span className="w-6 h-6 rounded-lg bg-white/70 text-gray-700 text-xs font-black flex items-center justify-center shrink-0">{key}</span>
            {text}
          </button>
        );
      })}
    </div>
  );
}
