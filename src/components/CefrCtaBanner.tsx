'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

interface CefrCtaBannerProps {
  onScroll: () => void;
}

export function CefrCtaBanner({ onScroll }: CefrCtaBannerProps) {
  const t = useTranslations('home.cefrBanner');

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
      <span>{t('message')}</span>
      <span aria-hidden="true">→</span>
    </div>
  );
}
