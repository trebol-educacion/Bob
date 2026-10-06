export interface InterviewProgressDotsProps {
  total: number;
  current: number;
}

function dotColor(index: number, current: number): string {
  if (index < current) return 'var(--color-bob-brand)';
  if (index === current) return 'color-mix(in oklab, var(--color-bob-brand) 60%, white)';
  return '#e5e7eb';
}

export function InterviewProgressDots({ total, current }: InterviewProgressDotsProps) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="w-2 h-2 rounded-full transition-colors" style={{ background: dotColor(i, current) }} />
      ))}
    </div>
  );
}
