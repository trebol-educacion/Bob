import React from 'react';
import type { GapSentence } from './types';

interface SentenceBankProps {
  sentences: GapSentence[];
  usedIds: string[];
}

export function SentenceBank({ sentences, usedIds }: SentenceBankProps) {
  return (
    <ul className="space-y-2">
      {sentences.map((sentence) => {
        const used = usedIds.includes(sentence.id);
        return (
          <li
            key={sentence.id}
            data-used={used}
            className={[
              'flex items-start gap-2 rounded-xl border px-3 py-2 text-sm leading-snug',
              used ? 'border-gray-100 bg-gray-50 text-gray-400' : 'border-emerald-100 bg-white text-gray-700',
            ].join(' ')}
          >
            <span className="shrink-0 w-5 h-5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700 text-[11px] font-bold flex items-center justify-center">
              {sentence.id}
            </span>
            <span>{sentence.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
