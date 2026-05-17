'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Flame, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getStudentStatsAction } from '@/actions/stats';

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const days = new Set(dates.map((d) => d.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const today = cursor.toISOString().slice(0, 10);
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

interface Props {
  onClick: () => void;
}

export function NavProgressChip({ onClick }: Props) {
  const t = useTranslations('dashboard');
  const [streak, setStreak] = useState<number | null>(null);
  const [xp, setXp] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getStudentStatsAction();
      setStreak(calcStreak(data.session_dates));
      const totalXp = data.rows.reduce(
        (sum, r) => sum + Math.round(r.avg_score * r.sessions_count),
        0
      );
      setXp(totalXp);
    } catch {
      setStreak(0);
      setXp(0);
    }
  }, []);

  useEffect(() => {
    void load();
    const onFocus = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const onCustom = () => void load();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('bob:stats-changed', onCustom);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('bob:stats-changed', onCustom);
    };
  }, [load]);

  const hasData = streak !== null && xp !== null;

  const streakTooltip = !hasData
    ? t('streakTooltipEmpty')
    : streak === 0
      ? t('streakTooltipZero')
      : streak === 1
        ? t('streakTooltipOne')
        : t('streakTooltip', { n: streak });

  const xpTooltip = !hasData
    ? t('xpTooltipEmpty')
    : t('xpTooltip', { xp: xp.toLocaleString() });

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={t('viewProgress')}
      title={t('viewProgressFull')}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className="group relative flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/25 transition-colors cursor-pointer"
    >
      <span className="flex items-center gap-1" title={streakTooltip}>
        <motion.span
          aria-hidden
          animate={
            streak && streak > 0
              ? { scale: [1, 1.18, 1], rotate: [0, -8, 8, 0] }
              : { scale: 1, rotate: 0 }
          }
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2 }}
        >
          <Flame
            size={14}
            strokeWidth={0}
            fill={streak && streak > 0 ? '#F8AC37' : 'rgba(255,255,255,0.5)'}
          />
        </motion.span>
        <span className="text-xs font-black tabular-nums text-white leading-none">
          {hasData ? streak : '—'}
        </span>
      </span>

      <span aria-hidden className="h-3 w-px bg-white/20" />

      <span className="hidden sm:flex items-center gap-1" title={xpTooltip}>
        <Sparkles size={12} strokeWidth={0} fill="#F8AC37" />
        <span className="text-xs font-black tabular-nums text-white leading-none">
          {hasData ? xp.toLocaleString() : '—'}
        </span>
        <span className="text-[9px] font-black uppercase tracking-widest text-white/65 ml-0.5">XP</span>
      </span>

      <span className="sm:hidden flex items-center gap-1" title={xpTooltip}>
        <Sparkles size={12} strokeWidth={0} fill="#F8AC37" />
        <span className="text-xs font-black tabular-nums text-white leading-none">
          {hasData ? (xp >= 1000 ? `${Math.round(xp / 100) / 10}k` : xp) : '—'}
        </span>
      </span>
    </motion.button>
  );
}
