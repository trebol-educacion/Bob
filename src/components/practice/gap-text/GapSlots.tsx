import React from 'react';
import type { GapReview, GapSentence } from './types';

export function BadgeSlot({ number }: { number: number }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-5 mx-0.5 rounded bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-300 leading-none align-middle">
      {number}
    </span>
  );
}

export function ReviewSlot({ review }: { review: GapReview }) {
  if (review.isCorrect) {
    return (
      <span className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-sm font-semibold border border-green-300 align-middle">
        {review.given}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-center mx-0.5 align-middle">
      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-sm font-semibold border border-red-300 line-through">
        {review.given}
      </span>
      <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-[11px] font-semibold border border-green-300 -mt-px">
        {review.expected}
      </span>
    </span>
  );
}

interface InputSlotProps {
  number: number;
  value: string;
  onChange: (value: string) => void;
  label: string;
  baseWord?: string;
}

export function InputSlot({ number, value, onChange, label, baseWord }: InputSlotProps) {
  const filled = value.trim() !== '';
  return (
    <span className="inline-flex items-baseline align-baseline mx-0.5">
      <span
        className={`mr-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black shrink-0 ${
          filled ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-400'
        }`}
        aria-hidden
      >
        {number}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…"
        autoComplete="off"
        aria-label={label}
        className={`bg-transparent border-0 border-b-2 px-1 text-base text-gray-800 placeholder-gray-300 focus:outline-none transition-colors duration-150 ${
          filled ? 'border-emerald-500' : 'border-gray-300 focus:border-emerald-500'
        }`}
        style={{ width: `${Math.max(3, value.length + 1)}ch`, minWidth: '3ch' }}
      />
      {baseWord && (
        <span className="ml-1.5 text-xs font-black uppercase tracking-wide text-emerald-700">{baseWord}</span>
      )}
    </span>
  );
}

interface SentenceSlotProps {
  number: number;
  value: string;
  onChange: (value: string) => void;
  label: string;
  sentences: GapSentence[];
}

export function SentenceSlot({ number, value, onChange, label, sentences }: SentenceSlotProps) {
  return (
    <span className="inline-flex items-center align-middle mx-0.5">
      <span
        className="mr-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black shrink-0"
        aria-hidden
      >
        {number}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="rounded border border-emerald-300 bg-white px-1 py-0.5 text-sm font-semibold text-gray-800 focus:outline-none focus:border-emerald-500"
      >
        <option value="">—</option>
        {sentences.map((sentence) => (
          <option key={sentence.id} value={sentence.id}>
            {sentence.id}
          </option>
        ))}
      </select>
    </span>
  );
}
