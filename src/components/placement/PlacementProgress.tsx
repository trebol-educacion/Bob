'use client';

import React from 'react';

export interface PlacementProgressProps {
  stepsCompleted: number;
}

const MAX_VISIBLE_SEGMENTS = 6;

/** @param props PlacementProgressProps */
export function PlacementProgress({ stepsCompleted }: PlacementProgressProps) {
  const segments = Math.min(stepsCompleted + 1, MAX_VISIBLE_SEGMENTS);

  return (
    <div className="w-full flex flex-col items-center gap-1 mb-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Part {stepsCompleted + 1}
      </p>
      <div className="w-full flex items-center gap-2">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i < segments - 1 ? 'bg-trebol-primary' : 'bg-trebol-primary/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
