type IconProps = {
  size?: number;
  className?: string;
};

const baseProps = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/**
 * CAE Speaking Part 1 — Interview.
 * Microphone with a small speech bubble: intimate, personal exchange with the examiner.
 */
export function CAEInterviewIcon({ size = 32, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      {...baseProps}
    >
      <rect x="11" y="5" width="7" height="13" rx="3.5" />
      <path d="M8 14a6.5 6.5 0 0 0 13 0" />
      <line x1="14.5" y1="20.5" x2="14.5" y2="25" />
      <line x1="11" y1="25" x2="18" y2="25" />
      <path d="M22 8h6a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 28 15h-1.5l-2 2v-2H22a1.5 1.5 0 0 1-1.5-1.5v-4A1.5 1.5 0 0 1 22 8Z" />
    </svg>
  );
}

/**
 * CAE Speaking Part 2 — Individual long turn.
 * Profile silhouette with sustained sound bars representing the one-minute monologue.
 */
export function CAELongTurnIcon({ size = 32, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      {...baseProps}
    >
      <circle cx="11" cy="11" r="3.5" />
      <path d="M5 25c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <line x1="20.5" y1="11" x2="20.5" y2="19" />
      <line x1="24" y1="8.5" x2="24" y2="21.5" />
      <line x1="27.5" y1="11" x2="27.5" y2="19" />
    </svg>
  );
}

/**
 * CAE Speaking Part 3 — Collaborative task.
 * Two facing profiles with overlapping speech bubbles: paired negotiation.
 */
export function CAECollaborativeIcon({ size = 32, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      {...baseProps}
    >
      <circle cx="8" cy="9" r="2.8" />
      <path d="M3.5 18c0-2.5 2-4.5 4.5-4.5S12.5 15.5 12.5 18" />
      <circle cx="24" cy="9" r="2.8" />
      <path d="M19.5 18c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" />
      <path d="M10 22h7a2 2 0 0 1 2 2v2l2 1.5V24a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2Z" />
    </svg>
  );
}

/**
 * CAE Speaking Part 4 — Discussion.
 * Two speech bubbles linked by a circular arrow: back-and-forth follow-up exchange.
 */
export function CAEDiscussionIcon({ size = 32, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      {...baseProps}
    >
      <path d="M4 7h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8l-2.5 2.5V15H4a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 4 7Z" />
      <path d="M28 17h-8a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4l2.5 2.5V25H28a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 28 17Z" />
      <path d="M16 11.5c4 0 7 2.5 7 5.5" />
      <polyline points="21,15 23,17 25,15" />
      <path d="M16 20.5c-4 0-7-2.5-7-5.5" />
      <polyline points="11,17 9,15 7,17" />
    </svg>
  );
}
