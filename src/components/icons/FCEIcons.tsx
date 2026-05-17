import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Cambridge FCE (B2) — Listening skill.
 * Podcast-style rounded square with a centered play triangle and rising waveform bars.
 */
export function FCEListeningIcon({ size = 28, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="5" y="5" width="16" height="16" rx="3.5" />
      <path d="M11 10.5v5l4.5-2.5z" />
      <path d="M24 12v8" />
      <path d="M27 9.5v13" />
      <path d="M21 14.5v3" />
    </svg>
  );
}

/**
 * Cambridge FCE (B2) — Reading & Use of English skill.
 * Stack of three books with a small bookmark ribbon on the top volume.
 */
export function FCEReadingIcon({ size = 28, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="5" y="22" width="22" height="5" rx="1.2" />
      <rect x="6.5" y="16" width="19" height="5" rx="1.2" />
      <rect x="8" y="6" width="16" height="9" rx="1.2" />
      <path d="M19 6v5l-1.5-1.2L16 11V6" />
    </svg>
  );
}

/**
 * Cambridge FCE (B2) — Writing skill.
 * Quill pen angled across the canvas with a tiny ink droplet near the nib.
 */
export function FCEWritingIcon({ size = 28, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M26 5c-2 6-7 12-13 16l-3 1 1-3C15 13 21 8 26 5z" />
      <path d="M11 21l-3 5" />
      <path d="M6 27l4-1" />
      <circle cx="13" cy="24" r="1" />
    </svg>
  );
}

/**
 * Cambridge FCE (B2) — Speaking skill.
 * Studio microphone with curved sound waves on each side.
 */
export function FCESpeakingIcon({ size = 28, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="13" y="5" width="6" height="13" rx="3" />
      <path d="M9 14a7 7 0 0 0 14 0" />
      <path d="M16 21v4" />
      <path d="M12 25h8" />
      <path d="M6 11c-.5 1-.5 2 0 3" />
      <path d="M26 11c.5 1 .5 2 0 3" />
    </svg>
  );
}
