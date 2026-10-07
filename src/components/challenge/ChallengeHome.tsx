'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Trophy } from 'lucide-react';
import { ChallengeCard } from '@/components/challenge/ChallengeCard';
import { challengesForLevel, type ChallengeFramework } from '@/lib/challenge/catalog';
import type { CefrLevel } from '@/lib/types/practice';

interface Props {
  studentLevel: CefrLevel | null;
  onSelectFramework: (framework: ChallengeFramework) => void;
  onBack: () => void;
}

/** Framework picker for the standalone certification challenge. */
export function ChallengeHome({ studentLevel, onSelectFramework, onBack }: Props) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
      <div className="shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 bg-white/75 backdrop-blur-md">
          <button
            onClick={onBack}
            className="group relative p-2 rounded-xl bg-white border border-trebol-border/60 hover:border-[#3660AB] hover:bg-[#dde4f2] transition-all shadow-sm"
            aria-label="Back"
          >
            <ArrowLeft size={18} className="text-trebol-text group-hover:text-[#3660AB] group-hover:-translate-x-0.5 transition-transform" strokeWidth={2.5} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-black text-trebol-text tracking-tight leading-none">
                Challenge
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#F8AC37]/20 text-[#d98e1d] text-[9px] font-black uppercase tracking-widest">
                <Trophy size={8} fill="#d98e1d" strokeWidth={0} />
                Test yourself
              </span>
            </div>
            <p className="text-[11px] text-trebol-text/55 font-bold mt-0.5 leading-none truncate">
              Take a full certification exam from start to finish
            </p>
          </div>
        </div>
        <div aria-hidden className="h-[3px] w-full" style={{ background: 'var(--color-bob-brand)' }} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-8"
          >
            <h2 className="text-2xl font-black text-trebol-text tracking-tight mb-1">Choose your challenge</h2>
            <p className="text-sm text-trebol-text/60 font-semibold max-w-sm mx-auto">
              A complete mock exam with all four skills, end to end.
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2">
            {challengesForLevel(studentLevel).map((option, index) => (
              <ChallengeCard
                key={option.id}
                option={option}
                index={index}
                onStart={() => option.framework && onSelectFramework(option.framework)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
