'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';

export interface ChoiceCardTheme {
  color: string;
  bgColor: string;
  borderColor: string;
}

export interface ChoiceCardProps {
  theme: ChoiceCardTheme;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  index: number;
  onClick: () => void;
  children?: React.ReactNode;
}

/** @param props ChoiceCardProps */
export function ChoiceCard({ theme, icon: Icon, title, subtitle, index, onClick, children }: ChoiceCardProps) {
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
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}
