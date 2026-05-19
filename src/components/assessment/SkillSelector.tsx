'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Headphones, Mic2, BookOpen, PenLine } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization';
import type { Skill } from '@/lib/types/skills';

function BobGreetingAvatar() {
  const [videoEnded, setVideoEnded] = useState(false);
  return (
    <div className="relative w-32 h-32 sm:w-40 sm:h-40 mx-auto mb-4 overflow-hidden rounded-full bg-white shadow-lg ring-4 ring-white">
      <motion.div
        animate={{ rotate: videoEnded ? [0, -6, 6, -4, 0] : 0 }}
        transition={{ delay: 0.2, duration: 1.4, ease: 'easeInOut' }}
        className="w-full h-full relative"
        style={{ transformOrigin: '50% 80%' }}
      >
        <img
          src="/bob_avatar.png"
          alt="Bob"
          className="absolute inset-0 w-full h-full object-cover object-[50%_0%] scale-95 origin-bottom"
        />
      </motion.div>
      {!videoEnded && (
        <video
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={() => setVideoEnded(true)}
          onError={() => setVideoEnded(true)}
          className="absolute inset-0 w-full h-full object-cover object-[50%_35%]"
        >
          <source src="/bob_hello.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}

type SkillTheme = {
  skill: Skill;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
};

const SKILL_THEMES: SkillTheme[] = [
  {
    skill: 'listening',
    title: 'Listening',
    description: 'Sharpen your ear with real audio and quick questions.',
    icon: Headphones,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-100',
  },
  {
    skill: 'speaking',
    title: 'Speaking',
    description: 'Practice your voice with guided prompts and instant feedback.',
    icon: Mic2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100',
  },
  {
    skill: 'reading',
    title: 'Reading',
    description: 'Read short texts and answer comprehension questions.',
    icon: BookOpen,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-100',
  },
  {
    skill: 'writing',
    title: 'Writing',
    description: 'Write short tasks and get personalized feedback.',
    icon: PenLine,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-100',
  },
];

interface SkillCardProps {
  theme: SkillTheme;
  cefrLevel: string | null;
  index: number;
  onClick: () => void;
}

function SkillCard({ theme, cefrLevel, index, onClick }: SkillCardProps) {
  const Icon = theme.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 + 0.2 }}
    >
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className={`h-full cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-2 ${theme.borderColor} group overflow-hidden relative bg-white rounded-2xl`}
      >
        <div
          className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 transition-transform duration-700 group-hover:scale-150 ${theme.bgColor} pointer-events-none`}
        />
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div
            className={`p-4 shadow-sm transition-all duration-500 group-hover:scale-105 ${theme.bgColor} rounded-2xl`}
          >
            <Icon className={`w-8 h-8 ${theme.color}`} />
          </div>

          <div className="space-y-2">
            <h3 className={`text-xl font-bold tracking-tight ${theme.color}`}>{theme.title}</h3>
            <p className="text-sm text-gray-500 leading-snug font-medium">{theme.description}</p>
          </div>

          <div className="min-h-[1.5rem] flex items-center justify-center">
            {cefrLevel ? (
              <span className={`text-xs font-bold uppercase tracking-wide ${theme.color}`}>
                Level {cefrLevel}
              </span>
            ) : (
              <span className="text-xs text-gray-400 font-medium">No level yet</span>
            )}
          </div>

          <button
            type="button"
            tabIndex={-1}
            className={`mt-2 w-full py-2 px-3 rounded-lg group-hover:bg-gray-50 border border-transparent group-hover:border-gray-100 font-bold transition-all cursor-pointer ${theme.color}`}
          >
            Explore
          </button>
        </div>
      </div>
    </motion.div>
  );
}

interface Props {
  onSelect: (skill: Skill) => void;
}

/** Skill-first home screen styled like Zoe (MIA). */
export function SkillSelector({ onSelect }: Props) {
  const { skillLevels } = useOrganization();

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-8"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 14 }}
        >
          <BobGreetingAvatar />
        </motion.div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900">
          Hi! <span className="inline-block">👋</span>
        </h1>
        <p className="text-base text-gray-500 font-medium mt-2">
          What would you like to practice today? Choose a skill:
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-5xl mx-auto">
        {SKILL_THEMES.map((theme, idx) => {
          const levelEntry = skillLevels?.[theme.skill];
          const cefrLevel = levelEntry?.cefr_level ?? null;
          return (
            <SkillCard
              key={theme.skill}
              theme={theme}
              cefrLevel={cefrLevel}
              index={idx}
              onClick={() => onSelect(theme.skill)}
            />
          );
        })}
      </div>
    </div>
  );
}
