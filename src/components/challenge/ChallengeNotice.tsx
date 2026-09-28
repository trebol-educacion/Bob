interface ChallengeNoticeProps {
  text: string;
}

/** Renders a Reading notice/sign as a clean paper-style card, matching the Reading activity treatment. */
export function ChallengeNotice({ text }: ChallengeNoticeProps) {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-trebol-border bg-white shadow-md">
      <div aria-hidden className="h-1.5 w-full bg-[#3660AB]" />
      <p className="whitespace-pre-line px-6 py-5 text-center text-base sm:text-lg font-bold leading-relaxed text-trebol-text">
        {text}
      </p>
    </div>
  );
}
