'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import type { FormativeFeedback } from '@/lib/types/practice';

export function FeedbackBlocks({ feedback }: { feedback: FormativeFeedback }) {
  const [modelOpen, setModelOpen] = useState(false);
  const highlights = feedback.highlights.length > 0 ? feedback.highlights : ['You spoke up, well done!'];
  const tip = feedback.suggestions.length > 0 ? feedback.suggestions[0] : null;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 space-y-1.5">
        <p className="text-xs font-bold text-green-800 inline-flex items-center gap-1">What you did well <Check className="w-3.5 h-3.5" /></p>
        {highlights.map((h, i) => (
          <p key={i} className="text-sm text-green-700 leading-snug">• {h}</p>
        ))}
      </div>
      {tip && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
          <p className="text-xs font-bold text-amber-800">Try next time</p>
          <p className="text-sm text-amber-700 leading-snug">• {tip}</p>
        </div>
      )}
      {feedback.model_answer && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setModelOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span>Example answer</span>
            {modelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <AnimatePresence>
            {modelOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                  <p className="text-sm text-gray-700 leading-relaxed italic">&quot;{feedback.model_answer}&quot;</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
