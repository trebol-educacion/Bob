'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { EcosystemProductCode, LauncherItem } from '@/lib/ecosystem/launcher-config';

const FALLBACK_STYLE: Record<EcosystemProductCode, string> = {
  mia: 'bg-purple-600',
  zoe: 'bg-sky-500',
  bob: 'bg-amber-500',
  noobe: 'bg-emerald-600',
  trebol: 'bg-red-500',
};

export interface EcosystemLauncherBarProps {
  items: LauncherItem[];
  collapsed: boolean;
  onToggle: () => void;
}

export function EcosystemLauncherBar({ items, collapsed, onToggle }: EcosystemLauncherBarProps) {
  const t = useTranslations('shell.ecosystem');

  return (
    <aside
      aria-label={t('ariaLabel')}
      className={cn(
        'sticky top-0 hidden h-svh shrink-0 flex-col items-center justify-center border-l border-gray-200 bg-white transition-[width] duration-200 md:flex',
        collapsed ? 'w-8' : 'w-16',
      )}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={t('show')}
          className="flex h-16 w-full items-center justify-center text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {items.map((item) => (
            <a
              key={item.code}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              title={t('goTo', { name: item.name })}
              className="flex w-14 flex-col items-center gap-1 rounded-lg py-1.5 transition-colors hover:bg-gray-100"
            >
              {item.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.logo}
                  alt={item.name}
                  className="h-9 w-9 rounded-full bg-white object-contain p-0.5 ring-1 ring-gray-200"
                />
              ) : (
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white',
                    FALLBACK_STYLE[item.code],
                  )}
                >
                  {item.name.charAt(0)}
                </span>
              )}
              <span className="text-[10px] font-medium leading-none text-gray-600">
                {item.name}
              </span>
            </a>
          ))}

          <button
            type="button"
            onClick={onToggle}
            aria-label={t('hide')}
            className="mt-2 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
