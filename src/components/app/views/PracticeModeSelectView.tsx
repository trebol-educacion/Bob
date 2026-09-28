'use client';

import React from 'react';
import { motion } from 'motion/react';
import { BobGreetingAvatar } from '@/components/BobGreetingAvatar';
import { useTranslations } from 'next-intl';
import { MessageCircle, Compass, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { PracticeActivityMode } from '@/lib/practice/types';

export interface PracticeModeSelectViewProps {
  onSelectMode: (mode: PracticeActivityMode) => void;
}

type ModeTheme = {
  mode: PracticeActivityMode;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
};

const MODE_THEMES: ModeTheme[] = [
  {
    mode: 'conversation',
    icon: MessageCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100',
  },
  {
    mode: 'situation',
    icon: Compass,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-100',
  },
  {
    mode: 'picture',
    icon: ImageIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-100',
  },
];

interface ModeCardProps {
  theme: ModeTheme;
  title: string;
  subtitle: string;
  index: number;
  onClick: () => void;
}

function ModeCard({ theme, title, subtitle, index, onClick }: ModeCardProps) {
  const Icon = theme.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 + 0.2 }}
    >
      <Card
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className={`h-full cursor-pointer hover:shadow-xl hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all duration-300 border-2 ${theme.borderColor} group overflow-hidden relative bg-white rounded-2xl py-0`}
      >
        <div
          className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 transition-transform duration-700 group-hover:scale-150 ${theme.bgColor} pointer-events-none`}
        />
        <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
          <div
            className={`p-4 shadow-sm transition-all duration-500 group-hover:scale-105 ${theme.bgColor} rounded-2xl`}
          >
            <Icon className={`w-8 h-8 ${theme.color}`} />
          </div>
          <div className="space-y-2">
            <h3 className={`text-xl font-bold tracking-tight ${theme.color}`}>{title}</h3>
            <p className="text-sm text-gray-500 leading-snug font-medium">{subtitle}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** @param props PracticeModeSelectViewProps */
export function PracticeModeSelectView({ onSelectMode }: PracticeModeSelectViewProps) {
  const t = useTranslations('practice.modeSelect');

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-8 max-w-2xl"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 14 }}
        >
          <BobGreetingAvatar size="md" />
        </motion.div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900">
          {t('heading')}
        </h1>
        <p className="text-base text-gray-500 font-medium mt-2">{t('subtitle')}</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl">
        {MODE_THEMES.map((theme, index) => (
          <ModeCard
            key={theme.mode}
            theme={theme}
            title={t(`${theme.mode}.title`)}
            subtitle={t(`${theme.mode}.subtitle`)}
            index={index}
            onClick={() => onSelectMode(theme.mode)}
          />
        ))}
      </div>
    </div>
  );
}
