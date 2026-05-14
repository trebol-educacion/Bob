'use client';

import React from 'react';

interface CefrCtaBannerProps {
  onScroll: () => void;
}

export function CefrCtaBanner({ onScroll }: CefrCtaBannerProps) {
  return (
    <div
      role="banner"
      onClick={onScroll}
      className="
        sticky top-0 z-10 w-full
        bg-yellow-50 border-b border-yellow-200
        px-4 py-2.5
        flex items-center justify-center gap-2
        cursor-pointer
        hover:bg-yellow-100 transition-colors
        text-sm font-semibold text-yellow-800
      "
    >
      <span>Selecciona tu nivel CEFR para acceder a más actividades</span>
      <span aria-hidden="true">→</span>
    </div>
  );
}
