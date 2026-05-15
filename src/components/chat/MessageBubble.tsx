'use client';

import React from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

export type ChatAccentColor = 'amber' | 'blue' | 'purple' | 'green';

const ACCENT_AVATAR: Record<ChatAccentColor, string> = {
  blue:   'bg-blue-50 text-blue-600 border border-blue-100',
  amber:  'bg-amber-50 text-amber-600 border border-amber-100',
  purple: 'bg-purple-50 text-purple-600 border border-purple-100',
  green:  'bg-green-50 text-green-600 border border-green-100',
};

export interface MessageBubbleProps {
  variant: 'user' | 'assistant';
  /** For assistant variant: Lucide icon rendered in the mini-avatar. */
  icon?: LucideIcon;
  accentColor?: ChatAccentColor;
  children: React.ReactNode;
  /** When true, skips the enter animation. Use for history messages rendered on mount. */
  noAnimate?: boolean;
}

export function MessageBubble({
  variant,
  icon: Icon,
  accentColor = 'blue',
  children,
  noAnimate = false,
}: MessageBubbleProps) {
  const isUser = variant === 'user';

  const bubble = (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && Icon && (
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mb-0.5 ${ACCENT_AVATAR[accentColor]}`}
        >
          <Icon size={14} />
        </div>
      )}
      {!isUser && !Icon && (
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mb-0.5 text-xs font-bold ${ACCENT_AVATAR[accentColor]}`}
        >
          B
        </div>
      )}
      <div
        className={
          isUser
            ? 'max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm'
            : 'max-w-[80%] bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm text-gray-800 px-4 py-3 text-sm leading-relaxed'
        }
      >
        {children}
      </div>
    </div>
  );

  if (noAnimate) return bubble;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {bubble}
    </motion.div>
  );
}
