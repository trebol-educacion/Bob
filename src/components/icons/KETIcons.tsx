import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Cambridge KET (A2) — Listening skill.
 * Headphones with organic sound waves curling outward from the right cup.
 */
export function KETListeningIcon({ size = 28, className }: IconProps) {
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
      <path d="M6 18v-2a10 10 0 0 1 20 0v2" />
      <path d="M6 18h3a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 9 25H7.5A1.5 1.5 0 0 1 6 23.5V18Z" />
      <path d="M26 18h-3a1.5 1.5 0 0 0-1.5 1.5v4A1.5 1.5 0 0 0 23 25h1.5A1.5 1.5 0 0 0 26 23.5V18Z" />
      <path d="M27.5 19.5c1.2.6 2 1.6 2 2.8s-.8 2.2-2 2.8" />
      <path d="M28 16c2.2 1 3.5 3.2 3.5 5.6S30.2 26.2 28 27.2" />
    </svg>
  );
}

/**
 * Cambridge KET (A2) — Reading skill.
 * Open book with a thin bookmark hanging from the right page.
 */
export function KETReadingIcon({ size = 28, className }: IconProps) {
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
      <path d="M4 7.5c3.5-.6 7 0 9.5 1.8L16 11l2.5-1.7c2.5-1.8 6-2.4 9.5-1.8v15.5c-3.5-.6-7 0-9.5 1.8L16 26.5l-2.5-1.7c-2.5-1.8-6-2.4-9.5-1.8V7.5Z" />
      <path d="M16 11v15.5" />
      <path d="M22 9.5v9l1.5-1.5L25 18.5v-9" />
      <path d="M7 12h4" />
      <path d="M7 15h4" />
    </svg>
  );
}

/**
 * Cambridge KET (A2) — Writing skill.
 * Pencil writing across a small sheet with a folded corner.
 */
export function KETWritingIcon({ size = 28, className }: IconProps) {
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
      <path d="M5 22V8a1.5 1.5 0 0 1 1.5-1.5h11L22 11v4" />
      <path d="M17.5 6.5V11H22" />
      <path d="M9 12h6" />
      <path d="M9 15h4" />
      <path d="M26.5 14.5l2 2-9 9-3 .8.8-3 9.2-8.8Z" />
      <path d="M24.5 16.5l2 2" />
    </svg>
  );
}

/**
 * Cambridge KET (A2) — Speaking skill.
 * Speech bubble with a small waveform pulsing inside.
 */
export function KETSpeakingIcon({ size = 28, className }: IconProps) {
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
      <path d="M5 7.5h22a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H13l-5 4v-4H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
      <path d="M10 15v2" />
      <path d="M13 13v6" />
      <path d="M16 11.5v9" />
      <path d="M19 13v6" />
      <path d="M22 15v2" />
    </svg>
  );
}
