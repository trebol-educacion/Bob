'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { ProgressBar } from '@/components/ProgressBar';

interface ChatShellProps {
  mode: 'situation' | 'image' | 'conversation';
  title: string;
  subtitle?: string;
  progress?: { current: number; total: number };
  onBack?: () => void;
  noAnimate?: boolean;
  children: React.ReactNode;
}

export function ChatShell({
  mode,
  title,
  subtitle,
  progress,
  onBack,
  noAnimate,
  children,
}: ChatShellProps) {
  const innerContent = (
    <>
      <header className="bg-[#3660AB] text-white px-6 py-4 flex items-center gap-3 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="p-1 -ml-1 rounded-sm hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black uppercase tracking-widest truncate">{title}</h2>
          {subtitle && (
            <p className="text-xs font-bold opacity-80 truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </header>

      {progress && (
        <div className="bg-white border-b border-trebol-border px-6 py-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-trebol-text/60">
              Progreso
            </span>
            <span className="text-[10px] font-bold text-trebol-text/60">
              {progress.current + 1} / {progress.total}
            </span>
          </div>
          <ProgressBar current={progress.current} total={progress.total} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-gray-50/50">{children}</div>
    </>
  );

  if (noAnimate) {
    return (
      <section className="w-full max-w-2xl mx-auto flex flex-col h-full bg-white border-2 border-trebol-border rounded-sm shadow-xl overflow-hidden">
        {innerContent}
      </section>
    );
  }

  return (
    <motion.section
      key={mode}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto flex flex-col h-full bg-white border-2 border-trebol-border rounded-sm shadow-xl overflow-hidden"
    >
      {innerContent}
    </motion.section>
  );
}
