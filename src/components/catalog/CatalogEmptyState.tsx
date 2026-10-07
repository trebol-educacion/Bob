'use client';

import React from 'react';
import { Clock } from 'lucide-react';

export interface CatalogEmptyStateProps {
  title: string;
  body: string;
}

/** @param props CatalogEmptyStateProps */
export function CatalogEmptyState({ title, body }: CatalogEmptyStateProps) {
  return (
    <div role="status" className="flex flex-col items-center text-center gap-3 py-16 px-6">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
        <Clock size={26} />
      </div>
      <p className="text-lg font-black text-gray-800">{title}</p>
      <p className="text-sm text-gray-500 max-w-sm">{body}</p>
    </div>
  );
}
