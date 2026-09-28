'use client';

import React from 'react';
import { Headphones, Mic2, BookOpen, PenLine } from 'lucide-react';
import { BobHeading } from '@/components/choice/BobHeading';
import { ChoiceCard, type ChoiceCardTheme } from '@/components/choice/ChoiceCard';
import { useOrganization } from '@/hooks/useOrganization';
import type { Skill } from '@/lib/types/skills';

type SkillTheme = ChoiceCardTheme & {
  skill: Skill;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
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

/** Formats a raw CEFR key for display: 'pre_a1' → 'Pre-A1', 'a2' → 'A2'. */
function formatCefrLevel(level: string): string {
  if (level === 'pre_a1') return 'Pre-A1';
  return level.toUpperCase();
}

interface Props {
  onSelect: (skill: Skill) => void;
}

/** Skill-first home screen styled like Zoe (MIA). */
export function SkillSelector({ onSelect }: Props) {
  const { skillLevels } = useOrganization();

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-10 px-4">
      <BobHeading
        size="lg"
        title={
          <>
            Hi! <span className="inline-block">👋</span>
          </>
        }
        subtitle="What would you like to practice today? Choose a skill:"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-5xl mx-auto">
        {SKILL_THEMES.map((theme, idx) => {
          const levelEntry = skillLevels?.[theme.skill];
          const cefrLevel = levelEntry?.cefr_level ?? null;
          return (
            <ChoiceCard
              key={theme.skill}
              theme={theme}
              icon={theme.icon}
              title={theme.title}
              subtitle={theme.description}
              index={idx}
              onClick={() => onSelect(theme.skill)}
            >
              <div className="min-h-[1.5rem] flex items-center justify-center">
                {cefrLevel ? (
                  <span className={`text-xs font-bold tracking-wide ${theme.color}`}>
                    Level {formatCefrLevel(cefrLevel)}
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
            </ChoiceCard>
          );
        })}
      </div>
    </div>
  );
}
