import React from 'react';
import { splitGapText } from './segments';
import { BadgeSlot, InputSlot, ReviewSlot, SentenceSlot } from './GapSlots';
import type { GapReview, GapSentence, GapTextMode } from './types';

export interface GapTextProps {
  text: string;
  mode: GapTextMode;
  values?: Record<number, string>;
  onChange?: (gapNumber: number, value: string) => void;
  review?: Record<number, GapReview>;
  baseWords?: Record<number, string>;
  sentences?: GapSentence[];
  gapLabel?: (gapNumber: number) => string;
}

const defaultGapLabel = (gapNumber: number) => `Gap ${gapNumber}`;

export function GapText({
  text,
  mode,
  values = {},
  onChange,
  review,
  baseWords,
  sentences = [],
  gapLabel = defaultGapLabel,
}: GapTextProps) {
  return (
    <>
      {splitGapText(text).map((segment, idx) => {
        if (segment.kind === 'text') return <span key={idx}>{segment.value}</span>;

        const { number } = segment;
        if (review) {
          const entry = review[number];
          return entry ? (
            <ReviewSlot key={idx} review={entry} />
          ) : (
            <span key={idx}>{`___${number}___`}</span>
          );
        }

        const handleChange = (value: string) => onChange?.(number, value);
        if (mode === 'input') {
          return (
            <InputSlot
              key={idx}
              number={number}
              value={values[number] ?? ''}
              onChange={handleChange}
              label={gapLabel(number)}
              baseWord={baseWords?.[number]}
            />
          );
        }
        if (mode === 'sentence-bank') {
          return (
            <SentenceSlot
              key={idx}
              number={number}
              value={values[number] ?? ''}
              onChange={handleChange}
              label={gapLabel(number)}
              sentences={sentences}
            />
          );
        }
        return <BadgeSlot key={idx} number={number} />;
      })}
    </>
  );
}
