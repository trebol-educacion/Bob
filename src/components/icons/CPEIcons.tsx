type IconProps = {
  size?: number;
  className?: string;
};

const baseProps = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function CPEInterviewIcon({ size = 32, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      {...baseProps}
    >
      <circle cx="11" cy="11" r="3.5" />
      <path d="M5 24c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <path d="M21 10c1.2 0 2.2 1 2.2 2.2 0 1.6-2.2 2.4-2.2 4" />
      <circle cx="21" cy="19.5" r="0.6" fill="currentColor" stroke="none" />
      <path d="M24.5 6.5c2 2 2 6 0 8" opacity="0.55" />
      <path d="M27 4c3 3 3 9 0 12" opacity="0.35" />
    </svg>
  );
}

export function CPECollaborativeIcon({ size = 32, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      {...baseProps}
    >
      <circle cx="8" cy="11" r="2.8" />
      <path d="M3.5 22c0-2.8 2-4.8 4.5-4.8s4.5 2 4.5 4.8" />
      <circle cx="24" cy="11" r="2.8" />
      <path d="M19.5 22c0-2.8 2-4.8 4.5-4.8s4.5 2 4.5 4.8" />
      <path d="M16 8v6" />
      <path d="M13 14h6" />
      <path d="M13 14l-2 3h4l-2-3z" />
      <path d="M19 14l-2 3h4l-2-3z" />
    </svg>
  );
}

export function CPEMonologueIcon({ size = 32, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      {...baseProps}
    >
      <circle cx="10" cy="11" r="3.2" />
      <path d="M4 23c0-3.3 2.7-5.8 6-5.8s6 2.5 6 5.8" />
      <path d="M19 16v-3" opacity="0.4" />
      <path d="M21.5 17.5v-6" opacity="0.55" />
      <path d="M24 18.5v-8" opacity="0.7" />
      <path d="M26.5 17.5v-6" opacity="0.55" />
      <path d="M29 16v-3" opacity="0.4" />
    </svg>
  );
}

export function CPEExtendedDiscussionIcon({ size = 32, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      {...baseProps}
    >
      <circle cx="8" cy="22" r="2.8" />
      <path d="M3.5 30c0-2.6 2-4.5 4.5-4.5" opacity="0.7" />
      <circle cx="24" cy="22" r="2.8" />
      <path d="M28.5 30c0-2.6-2-4.5-4.5-4.5" opacity="0.7" />
      <path d="M9 14c0-2.5 2-4.5 4.5-4.5h4c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5h-5L9 20.5V14z" />
      <path d="M14 4c0-1.7 1.4-3 3-3h3c1.7 0 3 1.3 3 3s-1.3 3-3 3h-3.5L13 8.5V4z" opacity="0.55" />
    </svg>
  );
}

export function CPEFinalDiscussionIcon({ size = 32, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      {...baseProps}
    >
      <circle cx="8" cy="16" r="2.8" />
      <path d="M3.5 24c0-2.6 2-4.5 4.5-4.5s4.5 1.9 4.5 4.5" />
      <circle cx="24" cy="16" r="2.8" />
      <path d="M19.5 24c0-2.6 2-4.5 4.5-4.5s4.5 1.9 4.5 4.5" />
      <path d="M13 10c2-2.5 4-2.5 6 0" />
      <path d="M18.2 9.2L19.3 10l-1.4 0.4" />
      <path d="M19 22c-2 2.5-4 2.5-6 0" />
      <path d="M13.8 22.8L12.7 22l1.4-0.4" />
    </svg>
  );
}
