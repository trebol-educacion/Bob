import React from 'react';
import type { MatchingChoice } from './types';

export function ChoiceReference({ choices }: { choices: MatchingChoice[] }) {
  const hasTexts = choices.some((choice) => choice.text);

  return (
    <div className={hasTexts ? 'space-y-3' : 'rounded-2xl border border-gray-100 bg-white p-4 space-y-1.5'}>
      {choices.map((choice) => (
        <div
          key={choice.key}
          className={hasTexts ? 'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm' : 'flex items-start gap-2 text-sm text-gray-700'}
        >
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0">
              {choice.key}
            </span>
            <span className={hasTexts ? 'text-sm font-bold text-gray-800' : 'leading-snug'}>{choice.label}</span>
          </div>
          {choice.text && <p className="mt-2 text-sm text-gray-600 leading-relaxed">{choice.text}</p>}
        </div>
      ))}
    </div>
  );
}
