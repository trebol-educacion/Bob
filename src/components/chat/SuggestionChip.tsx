'use client';

import React from 'react';

export interface SuggestionChipProps {
  text: string;
  onClick: () => void;
  disabled?: boolean;
}

export function SuggestionChip({ text, onClick, disabled = false }: SuggestionChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-blue-100 bg-blue-50/50 text-blue-600 text-xs font-medium px-3 py-1.5 hover:bg-blue-600 hover:text-white transition-all duration-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-50/50 disabled:hover:text-blue-600"
    >
      {text}
    </button>
  );
}
