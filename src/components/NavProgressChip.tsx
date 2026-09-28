'use client';

import { motion } from 'motion/react';
import { Route } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
  onClick: () => void;
}

/** Compact header button that opens the student progress dashboard. */
export function NavProgressChip({ onClick }: Props) {
  const t = useTranslations('dashboard');

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={t('myProgress')}
      title={t('viewProgressFull')}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/25 transition-colors cursor-pointer"
    >
      <Route size={15} strokeWidth={2.5} className="text-white" />
      <span className="text-xs font-black text-white leading-none whitespace-nowrap">
        {t('myProgress')}
      </span>
    </motion.button>
  );
}
