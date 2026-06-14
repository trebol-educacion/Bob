'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, BookOpen, Headphones, Mic, PenLine, Trophy, X } from 'lucide-react';
import { getCambridgeA2Exam, type ChallengeSkill } from '@/lib/challenge/cambridge-a2';
import { scoreExam, type ExamSummary } from '@/lib/challenge/scoring';
import { ChallengePart, type PartAnswers } from './ChallengePart';

interface Props {
  onExit: () => void;
}

const SKILL_ICON: Record<ChallengeSkill, typeof Mic> = {
  listening: Headphones,
  reading: BookOpen,
  writing: PenLine,
  speaking: Mic,
};

const SKILL_COLOR: Record<ChallengeSkill, string> = {
  listening: '#F8AC37',
  reading: '#469E7B',
  writing: '#9333EA',
  speaking: '#3660AB',
};

/** Sequential runner for the full A2 Key challenge: one part at a time + summary. */
export function ChallengeRunner({ onExit }: Props) {
  const exam = useMemo(() => getCambridgeA2Exam(), []);
  const [index, setIndex] = useState(0);
  const [answersByPart, setAnswersByPart] = useState<Record<string, PartAnswers>>({});
  const [summary, setSummary] = useState<ExamSummary | null>(null);

  const total = exam.parts.length;
  const part = exam.parts[index];
  const progress = ((index + 1) / total) * 100;

  const setAnswer = (itemId: string, value: string) => {
    setAnswersByPart((prev) => ({
      ...prev,
      [part.id]: { ...(prev[part.id] ?? {}), [itemId]: value },
    }));
  };

  const goNext = () => {
    if (index < total - 1) {
      setIndex((i) => i + 1);
    } else {
      setSummary(scoreExam(exam.parts, answersByPart));
    }
  };

  const goBack = () => setIndex((i) => Math.max(0, i - 1));

  if (summary) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
        <div className="shrink-0">
          <div className="flex items-center gap-3 px-4 py-3 bg-white/75 backdrop-blur-md">
            <button
              onClick={onExit}
              className="group p-2 rounded-xl bg-white border border-trebol-border/60 hover:border-[#3660AB] hover:bg-[#dde4f2] transition-all shadow-sm"
              aria-label="Exit"
            >
              <X size={18} className="text-trebol-text group-hover:text-[#3660AB] transition-colors" strokeWidth={2.5} />
            </button>
            <h1 className="text-base font-black text-trebol-text tracking-tight">Your results</h1>
          </div>
          <div aria-hidden className="h-[3px] w-full" style={{ background: 'var(--color-bob-brand)' }} />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto w-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 16 }}
              className="text-center mb-8 rounded-3xl p-6 text-white shadow-xl"
              style={{ background: 'linear-gradient(135deg, #3660AB, #2a4d8a)' }}
            >
              <Trophy size={44} className="mx-auto mb-2" fill="currentColor" strokeWidth={1.5} />
              <h2 className="text-2xl font-black tracking-tight">Challenge complete!</h2>
              <p className="text-sm font-bold text-white/80 mt-1">
                Objective score: {summary.objectiveCorrect} / {summary.objectiveTotal}
              </p>
            </motion.div>

            <div className="space-y-2.5">
              {summary.results.map((r) => {
                const Icon = SKILL_ICON[r.skill];
                const color = SKILL_COLOR[r.skill];
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-trebol-border p-3">
                    <span
                      className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white"
                      style={{ background: color }}
                    >
                      <Icon size={18} strokeWidth={2.5} />
                    </span>
                    <p className="flex-1 text-sm font-black text-trebol-text">{r.title}</p>
                    {r.kind === 'objective' ? (
                      <span className="text-sm font-black text-trebol-text">
                        {r.correct} / {r.total}
                      </span>
                    ) : (
                      <span className="text-xs font-black text-[#469E7B] text-right max-w-[140px]">
                        Submitted — qualitative feedback
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={onExit}
              className="mt-8 w-full rounded-2xl bg-[#3660AB] text-white font-black py-3 shadow-md hover:bg-[#2a4d8a] transition-colors"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
      <div className="shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 bg-white/75 backdrop-blur-md">
          <button
            onClick={onExit}
            className="group p-2 rounded-xl bg-white border border-trebol-border/60 hover:border-[#3660AB] hover:bg-[#dde4f2] transition-all shadow-sm"
            aria-label="Exit"
          >
            <X size={18} className="text-trebol-text group-hover:text-[#3660AB] transition-colors" strokeWidth={2.5} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black text-trebol-text tracking-tight leading-none">{exam.title}</h1>
            <p className="text-[11px] text-trebol-text/55 font-bold mt-0.5 leading-none">
              Part {index + 1} of {total}
            </p>
          </div>
        </div>
        <div className="h-1.5 w-full bg-trebol-border/50">
          <motion.div
            className="h-full"
            style={{ background: 'var(--color-bob-brand)' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 py-6 max-w-2xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={part.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
            >
              <ChallengePart part={part} answers={answersByPart[part.id] ?? {}} onChange={setAnswer} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="shrink-0 border-t border-trebol-border bg-white/90 backdrop-blur-md px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={goBack}
            disabled={index === 0}
            className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-trebol-border px-4 py-2 text-sm font-black text-trebol-text disabled:opacity-40 hover:border-[#3660AB] transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
            Back
          </button>
          <button
            onClick={goNext}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-[#3660AB] text-white px-5 py-2 text-sm font-black shadow-md hover:bg-[#2a4d8a] transition-colors"
          >
            {index < total - 1 ? 'Next' : 'Finish'}
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
