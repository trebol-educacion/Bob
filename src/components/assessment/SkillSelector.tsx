'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Headphones, Mic2, BookOpen, PenLine } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization';
import type { Skill } from '@/lib/types/skills';

interface SkillCardProps {
  skill: Skill;
  label: string;
  icon: React.ReactNode;
  color: string;
  softColor: string;
  cefrLevel: string | null;
  disabled: boolean;
  onClick: () => void;
}

function SkillCard({ skill: _skill, label, icon, color, softColor, cefrLevel, disabled, onClick }: SkillCardProps) {
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      whileHover={disabled ? {} : { scale: 1.03 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      aria-disabled={disabled}
      title={disabled ? 'Aún no disponible' : undefined}
      className={[
        'relative flex flex-col items-center justify-center gap-3 rounded-2xl p-6 text-center transition-shadow',
        disabled
          ? 'opacity-50 cursor-not-allowed bg-gray-50 border-2 border-dashed border-gray-200'
          : 'cursor-pointer border-2 border-transparent shadow-md hover:shadow-lg',
      ].join(' ')}
      style={disabled ? {} : { backgroundColor: softColor, borderColor: color }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-sm"
        style={{ backgroundColor: disabled ? '#9ca3af' : color }}
      >
        {icon}
      </div>

      <p className="font-bold text-base text-gray-700">{label}</p>

      {cefrLevel ? (
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: disabled ? '#9ca3af' : color }}
        >
          {cefrLevel.toUpperCase()}
        </span>
      ) : (
        <span className="text-xs text-gray-400 font-medium">Sin nivel</span>
      )}

      {disabled && (
        <span className="absolute top-2 right-2 text-[10px] bg-gray-200 text-gray-500 rounded px-1.5 py-0.5 font-medium">
          Aún no disponible
        </span>
      )}
    </motion.button>
  );
}

const SKILL_CONFIG: {
  skill: Skill;
  label: string;
  icon: React.ReactNode;
  color: string;
  softColor: string;
  disabled: boolean;
}[] = [
  {
    skill: 'listening',
    label: 'Listening',
    icon: <Headphones size={24} />,
    color: '#F8AC37',
    softColor: '#fef3e0',
    disabled: false,
  },
  {
    skill: 'speaking',
    label: 'Speaking',
    icon: <Mic2 size={24} />,
    color: '#3660AB',
    softColor: '#dde4f2',
    disabled: false,
  },
  {
    skill: 'reading',
    label: 'Reading',
    icon: <BookOpen size={24} />,
    color: '#469E7B',
    softColor: '#dcebe3',
    disabled: true,
  },
  {
    skill: 'writing',
    label: 'Writing',
    icon: <PenLine size={24} />,
    color: '#E62D2B',
    softColor: '#fad6d5',
    disabled: true,
  },
];

interface Props {
  onSelect: (skill: Skill) => void;
}

/** Skill-first home screen: shows 4 skill cards with current CEFR level. */
export function SkillSelector({ onSelect }: Props) {
  const { skillLevels } = useOrganization();

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-10 px-4">
      <div className="max-w-xl w-full space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-gray-800">What would you like to practice?</h1>
          <p className="text-sm text-gray-500 font-medium">Choose a skill to get started</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {SKILL_CONFIG.map(({ skill, label, icon, color, softColor, disabled }) => {
            const levelEntry = skillLevels?.[skill];
            const cefrLevel = levelEntry?.cefr_level ?? null;

            return (
              <SkillCard
                key={skill}
                skill={skill}
                label={label}
                icon={icon}
                color={color}
                softColor={softColor}
                cefrLevel={cefrLevel}
                disabled={disabled}
                onClick={() => onSelect(skill)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
