import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

const baseSvgProps = {
  viewBox: '0 0 32 32',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/**
 * "Find the Differences" — Cambridge YL Movers Part 1.
 * Two side-by-side picture frames with a small "spot" mark on the right one.
 */
export function FindTheDifferencesIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} className={className}>
      <rect x="3.5" y="8" width="11" height="13" rx="1.5" />
      <rect x="17.5" y="8" width="11" height="13" rx="1.5" />
      <circle cx="7.5" cy="13" r="1.4" />
      <path d="M5.5 18.5l3-3 2 2" />
      <circle cx="21.5" cy="13" r="1.4" />
      <path d="M19.5 18.5l3-3 2 2" />
      <circle cx="25.5" cy="12" r="0.9" />
      <path d="M24 24.5l1.5 1.5 3-3.5" />
    </svg>
  );
}

/**
 * "Information Exchange" — Cambridge YL Movers Part 2.
 * Two speech bubbles facing each other with a tiny exchange arrow between them.
 */
export function InformationExchangeIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} className={className}>
      <path d="M3.5 8.5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8l-2.5 2.5V15.5H5.5a2 2 0 0 1-2-2z" />
      <path d="M28.5 14.5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2H24l2.5 2.5V21.5h0a2 2 0 0 0 2-2z" />
      <path d="M13.5 19.5h5" />
      <path d="M16.5 17.5l2 2-2 2" />
      <path d="M18.5 23.5h-5" />
      <path d="M15.5 25.5l-2-2 2-2" />
    </svg>
  );
}

/**
 * "Picture Story" — Cambridge YL Movers Part 3.
 * Four small panels in a row with an arrow showing narrative sequence.
 */
export function PictureStoryMoversIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} className={className}>
      <rect x="3" y="9" width="5.5" height="7" rx="1" />
      <rect x="10" y="9" width="5.5" height="7" rx="1" />
      <rect x="17" y="9" width="5.5" height="7" rx="1" />
      <rect x="24" y="9" width="5.5" height="7" rx="1" />
      <path d="M5 21.5h22" />
      <path d="M25 19.5l2 2-2 2" />
      <circle cx="5.75" cy="12" r="0.9" />
      <path d="M12.75 13l1.5-1.5" />
      <path d="M19.25 13.5l1.5-1.5" />
      <path d="M26.25 12.5l1.5 1.5" />
    </svg>
  );
}

/**
 * "Personal Questions" — Cambridge YL Movers Part 4.
 * A round speech bubble with a friendly smiley face inside.
 */
export function PersonalQuestionsMoversIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} className={className}>
      <path d="M5 6.5h22a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5H14l-5 4.5v-4.5H5A2.5 2.5 0 0 1 2.5 20V9A2.5 2.5 0 0 1 5 6.5z" />
      <circle cx="12" cy="13" r="1.1" />
      <circle cx="20" cy="13" r="1.1" />
      <path d="M11.5 17.5c1.2 1.4 2.7 2 4.5 2s3.3-.6 4.5-2" />
    </svg>
  );
}

/**
 * "More About You" — Cambridge YL Movers Part 5 (extended personal questions).
 * Two friend silhouettes with a small chat dot between them.
 */
export function MoreAboutYouIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} className={className}>
      <circle cx="9" cy="11" r="3" />
      <path d="M3.5 23c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
      <circle cx="23" cy="11" r="3" />
      <path d="M17.5 23c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
      <circle cx="16" cy="8" r="0.9" />
      <circle cx="16" cy="11" r="0.9" />
      <circle cx="16" cy="14" r="0.9" />
    </svg>
  );
}
