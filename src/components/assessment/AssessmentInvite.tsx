'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization';
import type { Skill } from '@/lib/types/skills';

interface Props {
  skill: Skill;
  onStartAssessment: () => void;
  onSkipToA1: () => void;
  onBack: () => void;
}

const SKILL_LABEL: Record<Skill, string> = {
  listening: 'Listening',
  speaking: 'Speaking',
  reading: 'Reading',
  writing: 'Writing',
};

/** Invitation screen shown when a student has no level (or is re-evaluating) for a skill. */
export function AssessmentInvite({ skill, onStartAssessment, onSkipToA1, onBack }: Props) {
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

        <div className="bg-white rounded-3xl shadow-md p-8 space-y-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mx-auto">
            <ClipboardList size={28} className="text-blue-600" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-xl font-black text-gray-800">
              {hasExistingLevel
                ? `Check your ${skillLabel} level`
                : `Find your ${skillLabel} level`}
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
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
                'w-full py-3 px-5 rounded-2xl font-bold text-sm transition-colors',
                cooldownActive
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
              ].join(' ')}
            >
              {cooldownActive
                ? daysRemaining > 14 && cooldownInfo.availableAt
                  ? `Available on ${cooldownInfo.availableAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : `Available in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`
                : 'Start Assessment'}
            </motion.button>

            <button
              onClick={onSkipToA1}
              className="w-full py-2.5 px-5 rounded-2xl font-semibold text-sm text-gray-600 hover:bg-gray-50 transition-colors border border-gray-200"
            >
              {hasExistingLevel ? 'Keep current level' : 'Start with A1'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
