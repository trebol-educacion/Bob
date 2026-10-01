'use client';

import React from 'react';
import type { useTranslations } from 'next-intl';
import type { FCEEssayPrompt } from '@/actions/modes/fce-writing-part1';

export function EssayBriefCard({
  prompt,
  t,
}: {
  prompt: FCEEssayPrompt;
  t: ReturnType<typeof useTranslations<'cambridge'>>;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-4 space-y-3"
      style={{
        background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)',
        border: '1px solid color-mix(in oklab, var(--color-bob-brand) 15%, white)',
      }}
    >
      <p className="text-xs text-gray-400 italic leading-snug">{prompt.context}</p>

      <div
        className="pl-3"
        style={{ borderLeft: '4px solid color-mix(in oklab, var(--color-bob-brand) 25%, white)' }}
      >
        <h2 className="text-base font-bold text-gray-800 leading-snug">{prompt.title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{prompt.essayQuestion}</p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-widest text-bob-brand">
          {t('fce.essay.notesLabel')}
        </p>
        {prompt.notes.map((note, i) => (
          <div key={note.id} className="flex items-start gap-2 text-sm">
            <span
              className="mt-0.5 shrink-0 w-5 h-5 rounded-full text-bob-brand text-xs font-bold flex items-center justify-center"
              style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)' }}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-gray-700">{note.label}</span>
              {note.label.toLowerCase() === 'your own idea' && (
                <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide">
                  {t('fce.essay.yourOwnIdeaBadge')}
                </span>
              )}
              <p className="text-xs text-gray-500 leading-snug mt-0.5">{note.description}</p>
            </div>
          </div>
        ))}
      </div>

      <p
        className="text-[11px] text-gray-400 pt-2"
        style={{ borderTop: '1px solid color-mix(in oklab, var(--color-bob-brand) 15%, white)' }}
      >
        {t('fce.essay.words')} 140-190
      </p>
    </div>
  );
}
