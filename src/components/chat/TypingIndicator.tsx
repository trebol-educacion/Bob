'use client';

import React from 'react';
import { motion } from 'motion/react';

/**
 * TypingIndicator — renders an assistant-style bubble with 3 animated dots.
 * Shows while Bob is generating a response.
 */
export function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 justify-start">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mb-0.5 bg-amber-50 text-amber-600 border border-amber-100 text-xs font-bold">
        B
      </div>
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 bg-gray-300 rounded-full inline-block"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}
