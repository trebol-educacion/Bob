'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Award, Lock, Sparkles, Target } from 'lucide-react';
import type { ChallengeOption } from '@/lib/challenge/catalog';

interface ChallengeCardProps {
  option: ChallengeOption;
  index: number;
  onStart: () => void;
}

function LevelBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F8AC37] text-white text-[10px] font-black uppercase tracking-widest mb-4 ml-2">
      <Target size={10} strokeWidth={3} />
      Your level
    </span>
  );
}

/** @param props ChallengeCardProps */
export function ChallengeCard({ option, index, onStart }: ChallengeCardProps) {
  const entrance = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: 0.05 * (index + 1) } };

  if (option.available) {
    return (
      <motion.button
        {...entrance}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
        onClick={onStart}
        className="group text-left relative overflow-hidden rounded-3xl p-6 shadow-xl text-white"
        style={{ background: 'linear-gradient(135deg, #3660AB, #2a4d8a)' }}
      >
        <div className="absolute -right-6 -top-6 opacity-20">
          <Award size={120} strokeWidth={1.5} />
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-widest mb-4">
          <Sparkles size={10} fill="currentColor" strokeWidth={0} />
          Active
        </span>
        {option.matchesLevel && <LevelBadge />}
        <h3 className="text-xl font-black tracking-tight mb-1">{option.title}</h3>
        <p className="text-sm font-semibold text-white/80 mb-4">{option.description}</p>
        <span className="inline-flex items-center gap-1.5 text-sm font-black bg-white text-[#3660AB] px-4 py-2 rounded-2xl shadow-sm group-hover:gap-2.5 transition-all">
          Start exam
        </span>
      </motion.button>
    );
  }

  return (
    <motion.div
      {...entrance}
      aria-disabled
      className="relative overflow-hidden rounded-3xl p-6 border-2 border-dashed border-trebol-border bg-trebol-bg/40 text-trebol-text/50 cursor-not-allowed select-none"
    >
      <div className="absolute -right-6 -top-6 opacity-10">
        <Lock size={120} strokeWidth={1.5} />
      </div>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-trebol-text/10 text-trebol-text/50 text-[10px] font-black uppercase tracking-widest mb-4">
        <Lock size={10} strokeWidth={2.5} />
        Coming soon
      </span>
      {option.matchesLevel && <LevelBadge />}
      <h3 className="text-xl font-black tracking-tight mb-1 text-trebol-text/70">{option.title}</h3>
      <p className="text-sm font-semibold mb-4">{option.description} Not available yet.</p>
      <span className="inline-flex items-center gap-1.5 text-sm font-black bg-trebol-text/10 px-4 py-2 rounded-2xl">
        Locked
      </span>
    </motion.div>
  );
}
