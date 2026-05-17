type IconProps = {
  size?: number;
  className?: string;
};

/**
 * Cambridge Flyers Speaking Part 1 — "Find the differences".
 * Two overlapping framed pictures with a magnifying glass on top.
 */
export function FlyersFindDifferencesIcon({ size = 32, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
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
      <rect x="4" y="6" width="13" height="11" rx="1.5" />
      <path d="M7 13l2.2-2.6 2.4 2.1 2-1.6 3.4 3" />
      <circle cx="9.2" cy="9.4" r="0.9" />
      <rect x="11" y="11" width="13" height="11" rx="1.5" />
      <path d="M14 18l2-2.4 2.4 2 2.1-1.7 3.5 3" />
      <circle cx="16.2" cy="14.4" r="0.9" />
      <circle cx="22.5" cy="23" r="3.6" />
      <path d="M25.2 25.6L28 28.4" />
    </svg>
  );
}
