'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Trophy, Star, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface CelebrationCardProps {
  score: number;
  scoreMax: number;
  feedback?: string;
  onAction?: () => void;
  actionLabel?: string;
  /** When false, the dopaminergic effects (confetti, count-up) are skipped — useful in history view. */
  animate?: boolean;
}

function fireConfetti(intensity: 'mega' | 'normal' | 'mini') {
  const defaults = {
    spread: 70,
    ticks: 200,
    gravity: 0.9,
    decay: 0.94,
    startVelocity: 30,
    colors: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#fbbf24', '#fde047', '#10b981'],
  };
  if (intensity === 'mega') {
    confetti({ ...defaults, particleCount: 140, origin: { x: 0.2, y: 0.7 }, angle: 60 });
    confetti({ ...defaults, particleCount: 140, origin: { x: 0.8, y: 0.7 }, angle: 120 });
    setTimeout(() => {
      confetti({ ...defaults, particleCount: 80, origin: { x: 0.5, y: 0.6 }, spread: 100, startVelocity: 45 });
    }, 250);
    setTimeout(() => {
      confetti({ ...defaults, particleCount: 100, origin: { x: 0.3, y: 0.8 }, angle: 80 });
      confetti({ ...defaults, particleCount: 100, origin: { x: 0.7, y: 0.8 }, angle: 100 });
    }, 500);
  } else if (intensity === 'normal') {
    confetti({ ...defaults, particleCount: 100, origin: { x: 0.5, y: 0.7 } });
    setTimeout(() => {
      confetti({ ...defaults, particleCount: 60, origin: { x: 0.5, y: 0.6 }, spread: 90 });
    }, 200);
  } else {
    confetti({ ...defaults, particleCount: 40, origin: { x: 0.5, y: 0.7 }, spread: 50 });
  }
}

function useCountUp(target: number, durationMs: number, enabled: boolean) {
  const [value, setValue] = React.useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, enabled]);
  return value;
}

export function CelebrationCard({
  score,
  scoreMax,
  feedback,
  onAction,
  actionLabel,
  animate = true,
}: CelebrationCardProps) {
  const t = useTranslations('yl');
  const resolvedActionLabel = actionLabel ?? t('celebration.defaultActionLabel');
  const pct = scoreMax > 0 ? Math.round((score / scoreMax) * 100) : 0;
  const stars = pct === 100 ? 3 : pct >= 75 ? 2 : pct >= 50 ? 1 : 0;
  const tier: 'perfect' | 'great' | 'good' | 'keep' =
    pct === 100 ? 'perfect' : pct >= 75 ? 'great' : pct >= 50 ? 'good' : 'keep';

  const tierConfig = {
    perfect: { heading: t('celebration.perfect.heading'), sub: t('celebration.perfect.sub'), accent: 'text-amber-500', ring: 'ring-amber-200', glow: 'from-amber-100 via-violet-50 to-white' },
    great:   { heading: t('celebration.great.heading'), sub: t('celebration.great.sub'), accent: 'text-violet-600', ring: 'ring-violet-200', glow: 'from-violet-100 via-violet-50 to-white' },
    good:    { heading: t('celebration.good.heading'), sub: t('celebration.good.sub'), accent: 'text-violet-600', ring: 'ring-violet-100', glow: 'from-violet-50 via-white to-white' },
    keep:    { heading: t('celebration.keep.heading'), sub: t('celebration.keep.sub'), accent: 'text-slate-600', ring: 'ring-slate-200', glow: 'from-slate-50 via-white to-white' },
  }[tier];

  const passed = pct >= 50;
  const [celebrationDone, setCelebrationDone] = useState(!animate || !passed);

  const firedRef = useRef(false);
  useEffect(() => {
    if (!animate || firedRef.current) return;
    firedRef.current = true;
    const intensity: 'mega' | 'normal' | 'mini' = pct === 100 ? 'mega' : pct >= 75 ? 'normal' : 'mini';
    if (passed) {
      setTimeout(() => fireConfetti(intensity), 100);
      setTimeout(() => fireConfetti(intensity), 900);
    }
  }, [animate, pct, passed]);

  const displayedPct = useCountUp(pct, 900, animate && celebrationDone);

  if (!celebrationDone) {
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm">
        <div className="relative w-64 sm:w-80 aspect-[3/4]">
          <div
            aria-hidden
            className="absolute -inset-3 rounded-3xl"
            style={{
              background: 'conic-gradient(from 0deg, #F8AC37, #469E7B, #3660AB, #E62D2B, #F8AC37)',
              filter: 'blur(14px)',
              opacity: 0.55,
            }}
          />
          <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white">
            <video
              autoPlay
              muted
              playsInline
              preload="auto"
              onEnded={() => setCelebrationDone(true)}
              onError={() => setCelebrationDone(true)}
              className="w-full h-full object-cover"
            >
              <source src="/bob_celebrate.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
        <p className="mt-8 text-3xl sm:text-4xl font-black text-amber-600 font-nunito">
          {tierConfig.heading}
        </p>
      </div>
    );
  }

  const clickable = !!onAction;
  const Container = clickable ? motion.button : motion.div;
  const containerProps = clickable
    ? { type: 'button' as const, onClick: onAction, whileHover: { y: -2 }, whileTap: { scale: 0.99 } }
    : {};

  return (
    <Container
      {...containerProps}
      initial={animate ? { opacity: 0, y: 18, scale: 0.96 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      style={clickable ? { cursor: 'pointer' } : undefined}
      className={`group font-nunito relative overflow-hidden rounded-3xl bg-gradient-to-br ${tierConfig.glow} ring-1 ${tierConfig.ring} shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-lg transition-shadow p-6 max-w-md mx-auto text-left w-full`}
    >
      <motion.div
        initial={animate ? { scale: 0, rotate: -30 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.15 }}
        className="mx-auto w-20 h-20 rounded-2xl bg-white ring-1 ring-amber-100 flex items-center justify-center shadow-sm"
      >
        <Trophy size={42} className={tierConfig.accent} strokeWidth={1.8} />
      </motion.div>

      <div className="mt-4 text-center space-y-1">
        <h3 className={`text-2xl font-black ${tierConfig.accent} tracking-tight`}>
          {tierConfig.heading}
        </h3>
        <p className="text-sm font-semibold text-slate-500">{tierConfig.sub}</p>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        {[0, 1, 2].map((i) => {
          const filled = i < stars;
          return (
            <motion.div
              key={i}
              initial={animate ? { scale: 0, rotate: -20 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 12, delay: 0.45 + i * 0.18 }}
            >
              <Star
                size={36}
                strokeWidth={1.6}
                className={filled ? 'fill-amber-400 text-amber-500 drop-shadow-sm' : 'text-slate-200'}
              />
            </motion.div>
          );
        })}
      </div>

      <div className="mt-5 flex items-baseline justify-center gap-2">
        <motion.span
          initial={animate ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className={`text-5xl font-black tabular-nums ${tierConfig.accent}`}
        >
          {displayedPct}
        </motion.span>
        <span className="text-2xl font-black text-slate-400">%</span>
      </div>
      <p className="mt-1 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {score} / {scoreMax} {t('celebration.pointsLabel')}
      </p>

      {feedback && (
        <motion.p
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-4 text-center text-sm font-semibold text-slate-600 leading-snug px-2"
        >
          {feedback}
        </motion.p>
      )}

      {onAction && (
        <motion.div
          initial={animate ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05 }}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-700 text-white font-extrabold text-sm shadow-sm group-hover:shadow-md transition-shadow"
        >
          {resolvedActionLabel}
          <ChevronRight size={16} strokeWidth={2.6} className="group-hover:translate-x-0.5 transition-transform" />
        </motion.div>
      )}
    </Container>
  );
}
