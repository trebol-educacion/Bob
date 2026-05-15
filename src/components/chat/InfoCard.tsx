'use client';

import React from 'react';
import { Lightbulb } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface InfoCardProps {
  title: string;
  /** Lucide icon for the card header. Defaults to Lightbulb. */
  icon?: LucideIcon;
  children: React.ReactNode;
}

export function InfoCard({ title, icon: Icon = Lightbulb, children }: InfoCardProps) {
  return (
    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-amber-600 shrink-0" />
        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-sm text-amber-800/80 leading-relaxed">{children}</div>
    </div>
  );
}
