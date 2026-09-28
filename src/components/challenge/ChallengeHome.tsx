'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Award, Lock, Sparkles, Trophy } from 'lucide-react';

export type ChallengeFramework = 'cambridge_a2_key';

interface Props {
  onSelectFramework: (framework: ChallengeFramework) => void;
  onBack: () => void;
}

/** Framework picker for the standalone certification challenge. */
export function ChallengeHome({ onSelectFramework, onBack }: Props) {
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
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectFramework('cambridge_a2_key')}
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
              <h3 className="text-xl font-black tracking-tight mb-1">Cambridge A2 Key</h3>
              <p className="text-sm font-semibold text-white/80 mb-4">
                14 parts across Listening, Reading, Writing and Speaking.
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-black bg-white text-[#3660AB] px-4 py-2 rounded-2xl shadow-sm group-hover:gap-2.5 transition-all">
                Start exam
              </span>
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
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
              <h3 className="text-xl font-black tracking-tight mb-1 text-trebol-text/70">Oxford</h3>
              <p className="text-sm font-semibold mb-4">
                Oxford Test of English. Not available yet.
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-black bg-trebol-text/10 px-4 py-2 rounded-2xl">
                Locked
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
