'use client';

import React from 'react';
import { motion } from 'motion/react';
import { BobGreetingAvatar } from '@/components/BobGreetingAvatar';

const AVATAR_SIZES = {
  md: { avatar: 'md', heading: 'text-2xl md:text-3xl' },
  lg: { avatar: 'lg', heading: 'text-3xl md:text-4xl' },
} as const;

export interface BobHeadingProps {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}

/** @param props BobHeadingProps */
export function BobHeading({ title, subtitle, size = 'md', className = '' }: BobHeadingProps) {
  const config = AVATAR_SIZES[size];
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`text-center mb-8 ${className}`}
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 14 }}
      >
        <BobGreetingAvatar size={config.avatar} />
      </motion.div>
      <h1 className={`font-black tracking-tight text-gray-900 ${config.heading}`}>{title}</h1>
      <p className="text-base text-gray-500 font-medium mt-2">{subtitle}</p>
    </motion.div>
  );
}
