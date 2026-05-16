import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * "Listen and Point" — Cambridge YL Starters Part 1.
 * A pointing hand with a small sparkle, in a friendly thick-line style.
 * Custom artwork — not a generic lucide glyph.
 */
export function ListenAndPointIcon({ size = 28, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M13 18.5V8.5a2 2 0 1 1 4 0v6.5" />
      <path d="M17 14.5v-2a2 2 0 1 1 4 0v6" />
      <path d="M21 14a2 2 0 1 1 4 0v6.5a6.5 6.5 0 0 1-6.5 6.5h-2.2a6 6 0 0 1-4.5-2L8 21.5a2.2 2.2 0 0 1 3.2-3l1.8 2" />
      <path d="M9.5 6.5l-2 -1" />
      <path d="M7.5 9.5l-2 0" />
      <path d="M9 12.5l-1.5 1" />
    </svg>
  );
}
