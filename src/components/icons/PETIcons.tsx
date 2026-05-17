type IconProps = {
  size?: number;
  className?: string;
};

/**
 * PET Listening icon — headphones with a small music note between the cups.
 */
export function PETListeningIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 18v-2a11 11 0 0 1 22 0v2" />
      <path d="M5 18h4v8H7a2 2 0 0 1-2-2v-6Z" />
      <path d="M27 18h-4v8h2a2 2 0 0 0 2-2v-6Z" />
      <path d="M15 16v6" />
      <path d="M15 16l3-1v5" />
      <circle cx="14" cy="22" r="1.2" />
      <circle cx="17" cy="20" r="1.2" />
    </svg>
  );
}

/**
 * PET Reading icon — open book with multiple page lines suggesting a longer text.
 */
export function PETReadingIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 7h9a3 3 0 0 1 3 3v16a2 2 0 0 0-2-2H4V7Z" />
      <path d="M28 7h-9a3 3 0 0 0-3 3v16a2 2 0 0 1 2-2h10V7Z" />
      <path d="M7 12h6" />
      <path d="M7 16h6" />
      <path d="M7 20h4" />
      <path d="M19 12h6" />
      <path d="M19 16h6" />
      <path d="M19 20h4" />
    </svg>
  );
}

/**
 * PET Writing icon — fountain pen nib above a paper sheet with a signature line.
 */
export function PETWritingIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 4h12l5 5v19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M19 4v5h5" />
      <path d="M10 14h8" />
      <path d="M10 18h12" />
      <path d="M10 24h7" />
      <path d="M20 22l3-3 2 2-3 3-2.5.5.5-2.5Z" />
    </svg>
  );
}

/**
 * PET Speaking icon — two overlapping speech bubbles indicating a two-way conversation.
 */
export function PETSpeakingIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4l-4 4v-4H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
      <path d="M12 14h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3v3l-3-3h-7" />
    </svg>
  );
}
