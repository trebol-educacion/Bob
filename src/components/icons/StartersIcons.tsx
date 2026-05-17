import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * "Look and Answer" — Cambridge YL Starters Part 2.
 * A friendly eye with a small question mark floating beside it.
 */
export function LookAndAnswerIcon({ size = 28, className }: IconProps) {
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
      <path d="M3.5 17c2.8-4.5 6.8-7 10.5-7s7.7 2.5 10.5 7c-2.8 4.5-6.8 7-10.5 7s-7.7-2.5-10.5-7Z" />
      <circle cx="14" cy="17" r="3" />
      <circle cx="14" cy="17" r="0.6" fill="currentColor" stroke="none" />
      <path d="M24 7.5a2.2 2.2 0 1 1 3.4 1.8c-.8.5-1.4 1-1.4 1.9" />
      <path d="M26 13.2v.2" />
    </svg>
  );
}

/**
 * "Tell the Story" — Cambridge YL Starters Part 3.
 * Four small comic-strip panels in a row with a forward arrow underneath.
 */
export function TellTheStoryIcon({ size = 28, className }: IconProps) {
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
      <rect x="3.5" y="7" width="5.5" height="5.5" rx="1" />
      <rect x="10.75" y="7" width="5.5" height="5.5" rx="1" />
      <rect x="18" y="7" width="5.5" height="5.5" rx="1" />
      <rect x="25.25" y="7" width="3.25" height="5.5" rx="1" />
      <circle cx="6.25" cy="9.75" r="0.9" />
      <path d="M12.5 10.5l1.5-1.5 1.5 1.5" />
      <path d="M19.5 11l1.5-2 1.5 2" />
      <path d="M5 21h18" />
      <path d="M20 18l3 3-3 3" />
    </svg>
  );
}

/**
 * "Personal Questions" — Cambridge YL Starters Part 4.
 * A chat bubble with a small child silhouette inside, suggesting "tell me about you".
 */
export function PersonalQuestionsIcon({ size = 28, className }: IconProps) {
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
      <path d="M5 7h22a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-12l-5 4.5V22H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
      <circle cx="16" cy="13" r="2.4" />
      <path d="M11.5 19.5c.6-2.2 2.4-3.6 4.5-3.6s3.9 1.4 4.5 3.6" />
    </svg>
  );
}
