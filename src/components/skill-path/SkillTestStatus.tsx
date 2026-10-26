import { AlertTriangle, ClipboardList } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
  pending: boolean;
  failed: boolean;
  lastTest: string | null;
  color: string;
  soft: string;
}

/**
 * @param props Props
 * @returns JSX.Element
 */
export function SkillTestStatus({ pending, failed, lastTest, color, soft }: Props) {
  const t = useTranslations('dashboard');

  if (pending) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider" style={{ color }}>
        <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
        {t('testEvaluating')}
      </span>
    );
  }

  if (failed) {
    return (
      <span role="alert" className="flex items-center gap-1 text-[11px] font-bold text-amber-700">
        <AlertTriangle size={12} className="shrink-0" />
        {t('testFailed')}
      </span>
    );
  }

  if (lastTest) {
    return (
      <span
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
        style={{ background: soft, color }}
      >
        <ClipboardList size={10} />
        {lastTest}
      </span>
    );
  }

  return <span className="text-[10px] font-bold uppercase tracking-wider text-trebol-text/35">{t('testNone')}</span>;
}
