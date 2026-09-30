'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

export function Waveform() {
  const reduceMotion = useReducedMotion();
  const bars = [0, 1, 2, 3, 4];
  return (
    <div className="flex items-end gap-1 h-6" aria-hidden>
      {bars.map((i) => (
        <motion.span
          key={i}
          className="w-1.5 rounded-full bg-red-500"
          initial={{ height: 6 }}
          animate={reduceMotion ? { height: 14 } : { height: [6, 22, 6] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }}
        />
      ))}
    </div>
  );
}
