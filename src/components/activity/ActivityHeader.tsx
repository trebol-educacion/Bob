'use client';

import React from 'react';

export interface ActivityHeaderProps {
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  icon?: React.ReactNode;
  iconStyle?: React.CSSProperties;
  trailing?: React.ReactNode;
  backLabel?: string;
  onBack: () => void;
}

/** @param props ActivityHeaderProps */
export function ActivityHeader({ title, subtitle, badge, icon, iconStyle, trailing, backLabel = 'Go back', onBack }: ActivityHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
      <button
        type="button"
        onClick={onBack}
        className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
        aria-label={backLabel}
      >
        ←
      </button>
      {icon && (
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconStyle ? '' : 'bg-emerald-100'}`}
          style={iconStyle}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
      </div>
      {trailing}
      {badge && (
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
          {badge}
        </span>
      )}
    </div>
  );
}
