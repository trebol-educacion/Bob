'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ACCENT } from './speaking-theme';

export function ProgressDots({ total, currentIndex }: { total: number; currentIndex: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-center">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <span key={i} className="relative inline-flex">
            {current && !reduceMotion && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{ background: ACCENT }}
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: [1, 1.9], opacity: [0.4, 0] }}
                transition={{ duration: 1.4, ease: 'easeOut', repeat: Infinity }}
              />
            )}
            <span
              className="relative w-2.5 h-2.5 rounded-full transition-colors"
              style={
                done
                  ? { background: ACCENT }
                  : current
                    ? { background: 'white', boxShadow: `inset 0 0 0 2px ${ACCENT}` }
                    : { background: '#E5E7EB' }
              }
            />
          </span>
        );
      })}
    </div>
  );
}
