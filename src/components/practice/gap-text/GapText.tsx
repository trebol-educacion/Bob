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
  allowRepeatOptions?: boolean;
}

function takenByOtherGaps(values: Record<number, string>, gapNumber: number): ReadonlySet<string> {
  return new Set(
    Object.entries(values)
      .filter(([key, value]) => Number(key) !== gapNumber && value)
      .map(([, value]) => value),
  );
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
  allowRepeatOptions = true,
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
              takenIds={allowRepeatOptions ? undefined : takenByOtherGaps(values, number)}
            />
          );
        }
        return <BadgeSlot key={idx} number={number} />;
      })}
    </>
  );
}
