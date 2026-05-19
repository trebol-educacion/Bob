'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Headphones, Mic2, BookOpen, PenLine } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization';
import type { Skill } from '@/lib/types/skills';
import type { CefrLevel } from '@/lib/types/practice';

interface Props {
  skill: Skill;
  onStartAssessment: () => void;
  onPickLevel: (level: CefrLevel) => void;
  onBack: () => void;
}

const PICKABLE_LEVELS: CefrLevel[] = ['pre_a1', 'a1', 'a2', 'b1', 'b2'];
const LEVEL_LABEL: Record<CefrLevel, string> = {
  pre_a1: 'Pre-A1',
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
  c1: 'C1',
  c2: 'C2',
};

type Theme = {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  textHover: string;
  bg: string;
  border: string;
  borderHover: string;
  button: string;
  buttonHover: string;
};

const SKILL_THEME: Record<Skill, Theme> = {
  listening: {
    icon: Headphones,
    text: 'text-amber-600',
    textHover: 'hover:text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    borderHover: 'hover:border-amber-200',
    button: 'bg-amber-600 hover:bg-amber-700',
    buttonHover: 'hover:bg-amber-50',
  },
  speaking: {
    icon: Mic2,
    text: 'text-blue-600',
    textHover: 'hover:text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    borderHover: 'hover:border-blue-200',
    button: 'bg-blue-600 hover:bg-blue-700',
    buttonHover: 'hover:bg-blue-50',
  },
  reading: {
    icon: BookOpen,
    text: 'text-emerald-600',
    textHover: 'hover:text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    borderHover: 'hover:border-emerald-200',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    buttonHover: 'hover:bg-emerald-50',
  },
  writing: {
    icon: PenLine,
    text: 'text-purple-600',
    textHover: 'hover:text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
    borderHover: 'hover:border-purple-200',
    button: 'bg-purple-600 hover:bg-purple-700',
    buttonHover: 'hover:bg-purple-50',
  },
};

const SKILL_LABEL: Record<Skill, string> = {
  listening: 'Listening',
  speaking: 'Speaking',
  reading: 'Reading',
  writing: 'Writing',
};

/** Invitation screen shown when a student has no level (or is re-evaluating) for a skill. */
export function AssessmentInvite({ skill, onStartAssessment, onPickLevel, onBack }: Props) {
  const { skillLevels, assessmentCooldownDays } = useOrganization();

  const existingLevel = skillLevels?.[skill];
  const hasExistingLevel = Boolean(existingLevel?.cefr_level);

  const cooldownActive = (() => {
    if (!existingLevel?.last_assessment_at) return false;
    const lastAt = new Date(existingLevel.last_assessment_at).getTime();
    const cooldownMs = assessmentCooldownDays * 24 * 60 * 60 * 1000;
    return Date.now() - lastAt < cooldownMs;
  })();

  const cooldownInfo = (() => {
    if (!cooldownActive || !existingLevel?.last_assessment_at) return { days: 0, availableAt: null as Date | null };
    const lastAt = new Date(existingLevel.last_assessment_at).getTime();
    const cooldownMs = assessmentCooldownDays * 24 * 60 * 60 * 1000;
    const remaining = lastAt + cooldownMs - Date.now();
    const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    return { days, availableAt: new Date(lastAt + cooldownMs) };
  })();
  const daysRemaining = cooldownInfo.days;

  const skillLabel = SKILL_LABEL[skill];
  const theme = SKILL_THEME[skill];
  const SkillIcon = theme.icon;

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-10 px-4">
      <div className="max-w-md w-full space-y-6">

        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={`relative bg-white rounded-2xl border-2 ${theme.border} hover:shadow-xl transition-all duration-300 group overflow-hidden p-8 space-y-5`}
        >
          <div
            className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 transition-transform duration-700 group-hover:scale-150 ${theme.bg} pointer-events-none`}
          />

          <div className={`p-4 shadow-sm ${theme.bg} rounded-2xl w-fit mx-auto`}>
            <SkillIcon className={`w-8 h-8 ${theme.text}`} />
          </div>

          <div className="text-center space-y-2">
            <h2 className={`text-xl font-bold tracking-tight ${theme.text}`}>
              {hasExistingLevel
                ? `Check your ${skillLabel} level`
                : `Find your ${skillLabel} level`}
            </h2>
            <p className="text-sm text-gray-500 leading-snug font-medium">
              {hasExistingLevel
                ? `Your current level is ${existingLevel!.cefr_level.toUpperCase()}. Do a short assessment to see if you've improved.`
                : `Complete a short assessment so Bob can personalise your practice for ${skillLabel}.`}
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <motion.button
              onClick={cooldownActive ? undefined : onStartAssessment}
              disabled={cooldownActive}
              whileHover={cooldownActive ? {} : { scale: 1.02 }}
              whileTap={cooldownActive ? {} : { scale: 0.98 }}
              className={[
                'w-full py-3 px-5 rounded-2xl font-bold text-sm transition-colors shadow-sm text-white',
                cooldownActive
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : theme.button,
              ].join(' ')}
            >
              {cooldownActive
                ? daysRemaining > 14 && cooldownInfo.availableAt
                  ? `Available on ${cooldownInfo.availableAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : `Available in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`
                : 'Start Assessment'}
            </motion.button>

            {hasExistingLevel ? (
              <button
                onClick={() => onPickLevel(existingLevel!.cefr_level as CefrLevel)}
                className={`w-full py-2.5 px-5 rounded-2xl font-semibold text-sm text-gray-600 ${theme.buttonHover} ${theme.textHover} transition-colors border border-gray-200 ${theme.borderHover}`}
              >
                Keep current level ({existingLevel!.cefr_level.toUpperCase()})
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 text-center uppercase tracking-wide">
                  or start at a level
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {PICKABLE_LEVELS.map((lvl) => (
                    <motion.button
                      key={lvl}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => onPickLevel(lvl)}
                      className={`py-2 rounded-xl font-bold text-xs text-gray-700 bg-white ${theme.buttonHover} ${theme.textHover} border border-gray-200 ${theme.borderHover} transition-colors`}
                    >
                      {LEVEL_LABEL[lvl]}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
