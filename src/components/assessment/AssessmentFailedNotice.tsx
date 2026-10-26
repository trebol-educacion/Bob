import { AlertTriangle } from 'lucide-react';

interface Props {
  title: string;
  body: string;
}

/**
 * @param props Props
 * @returns JSX.Element
 */
export function AssessmentFailedNotice({ title, body }: Props) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-bold text-gray-700">{title}</p>
        <p className="text-xs text-gray-500 leading-snug">{body}</p>
      </div>
    </div>
  );
}
