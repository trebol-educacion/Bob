'use client';

import React from 'react';
import type { ChangeEvent } from 'react';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Textarea } from '@/components/ui/textarea';
import { wordStatus, type WordStatus } from '@/lib/writing/word-status';

export interface WritingComposerProps {
  value: string;
  placeholder: string;
  wordCount: number;
  minWords: number;
  maxWords: number;
  target: string;
  disabled?: boolean;
  error?: string | null;
  onChange: (next: string) => void;
  onSubmit: () => void;
}

const COUNT_COLOR: Record<WordStatus, string> = {
  short: 'text-amber-500',
  ok: 'text-green-600',
  long: 'text-red-400',
};

/** @param props WritingComposerProps */
export function WritingComposer({
  value,
  placeholder,
  wordCount,
  minWords,
  maxWords,
  target,
  disabled = false,
  error,
  onChange,
  onSubmit,
}: WritingComposerProps) {
  const t = useTranslations('common.writing');
  const status = wordStatus(wordCount, minWords, maxWords);
  const canSubmit = !disabled && value.trim().length > 0 && status !== 'short';

  return (
    <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-2">
        <Textarea
          value={value}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={t('editorLabel')}
          rows={8}
          className="min-h-40 max-h-[45vh] resize-y rounded-2xl border-gray-200 text-base leading-relaxed text-gray-800 placeholder:text-gray-400"
        />
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>
            {t('words')} <strong className={COUNT_COLOR[status]}>{wordCount}</strong> {target}
          </span>
          <span className="flex-1">
            {error ? (
              <span role="alert" className="text-red-500">{error}</span>
            ) : (
              status === 'short' && (
                <span className="text-amber-500">{t('moreToSend', { remaining: minWords - wordCount })}</span>
              )
            )}
          </span>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{ background: 'var(--color-bob-brand)' }}
          >
            {t('submit')}
            <Send size={16} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}
