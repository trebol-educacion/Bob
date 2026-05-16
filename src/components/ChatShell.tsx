'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

export type ChatAccentColor = 'amber' | 'blue' | 'purple' | 'green';

export type ChatHeaderConfig = {
  /** Lucide icon rendered inside the avatar circle */
  icon: LucideIcon;
  /** Primary heading */
  title: string;
  /** Secondary line */
  subtitle: string;
  /** Controls avatar bg/icon color and footer badge color. Default: 'amber' */
  accentColor?: ChatAccentColor;
  /** Mounted left of avatar (back button in YL modes) */
  leftSlot?: React.ReactNode;
  /** Mounted right of title block (progress bar, part badge in YL modes) */
  rightSlot?: React.ReactNode;
  /** Shows green pulse dot. Default: true */
  online?: boolean;
};

export type ChatFooterConfig = {
  /** Badge text: "SITUACIONES" | "CONVERSACIÓN" | "YL PART 1" */
  modeLabel: string;
  /** Model display name — import from ACTIVE_MODEL_LABEL in gemini.ts */
  modelName: string;
  /** Optional helper text rendered as a third line */
  helperText?: string;
};

export type ChatShellProps = {
  headerConfig: ChatHeaderConfig;
  footerConfig: ChatFooterConfig;
  /** Message list, cards, images — the scrollable body */
  children: React.ReactNode;
  /** Mode-specific mic bar, text input, send button — rendered above <ChatFooter> */
  inputSlot: React.ReactNode;
  /** Key for motion.section re-mount animation. Pass mode string. */
  animationKey?: string;
  /** Tailwind max-w-* class for the chat container. Defaults to 'max-w-2xl'. Pass 'max-w-full' to stretch. */
  maxWidthClass?: string;
};

const ACCENT: Record<
  ChatAccentColor,
  { avatarBg: string; avatarBorder: string; avatarIcon: string; badgeBg: string; badgeText: string }
> = {
  blue:   { avatarBg: 'bg-blue-50',   avatarBorder: 'border-blue-100',   avatarIcon: 'text-blue-600',   badgeBg: 'bg-blue-50',   badgeText: 'text-blue-600' },
  amber:  { avatarBg: 'bg-amber-50',  avatarBorder: 'border-amber-100',  avatarIcon: 'text-amber-600',  badgeBg: 'bg-amber-100', badgeText: 'text-amber-700' },
  purple: { avatarBg: 'bg-purple-50', avatarBorder: 'border-purple-100', avatarIcon: 'text-purple-600', badgeBg: 'bg-purple-50', badgeText: 'text-purple-600' },
  green:  { avatarBg: 'bg-green-50',  avatarBorder: 'border-green-100',  avatarIcon: 'text-green-600',  badgeBg: 'bg-green-50',  badgeText: 'text-green-600' },
};

function AssistantAvatar({
  icon: Icon,
  accentColor = 'amber',
  online = true,
}: {
  icon: LucideIcon;
  accentColor?: ChatAccentColor;
  online?: boolean;
}) {
  const a = ACCENT[accentColor];
  return (
    <div className="relative shrink-0">
      <div
        className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner border ${a.avatarBg} ${a.avatarBorder}`}
      >
        <Icon size={18} className={a.avatarIcon} />
      </div>
      {online && (
        <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
      )}
    </div>
  );
}

function ChatHeader({
  icon,
  title,
  subtitle,
  accentColor = 'amber',
  leftSlot,
  rightSlot,
  online = true,
}: ChatHeaderConfig) {
  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm flex-none px-4 py-3">
      <div className="flex items-center gap-3">
        {leftSlot && <div className="flex items-center gap-2 shrink-0">{leftSlot}</div>}
        <AssistantAvatar icon={icon} accentColor={accentColor} online={online} />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-gray-900 truncate">{title}</h2>
          <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        </div>
        {rightSlot && <div className="flex items-center shrink-0">{rightSlot}</div>}
      </div>
    </header>
  );
}

function ChatFooter({
  modeLabel,
  modelName,
  helperText,
  accentColor = 'amber',
}: ChatFooterConfig & { accentColor?: ChatAccentColor }) {
  const a = ACCENT[accentColor];
  return (
    <div className="flex-none px-4 py-2 bg-white border-t border-gray-100 flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <span
          className={`text-[9px] uppercase tracking-tighter font-extrabold rounded-md px-2 py-1 ${a.badgeBg} ${a.badgeText}`}
        >
          {modeLabel}
        </span>
      </div>
      <p className="text-[10px] text-gray-400">
        BOB • Basado en {modelName}
      </p>
      {helperText && (
        <p className="text-[10px] text-gray-400 italic">{helperText}</p>
      )}
    </div>
  );
}

/** Composable chat layout: sticky header, scrollable body, fixed input slot, footer. */
export function ChatShell({
  headerConfig: header,
  footerConfig: footer,
  children,
  inputSlot,
  animationKey,
  maxWidthClass = 'max-w-2xl',
}: ChatShellProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [children]);

  const { accentColor = 'amber' } = header;

  return (
    <motion.section
      key={animationKey}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`w-full ${maxWidthClass} mx-auto flex flex-col h-full bg-white rounded-sm shadow-xl overflow-hidden`}
    >
      <ChatHeader {...header} />

      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto bg-slate-50/30 px-4 py-4 space-y-3"
      >
        {children}
        <div ref={endRef} />
      </div>

      <div className="flex-none">
        {inputSlot}
        <ChatFooter {...footer} accentColor={accentColor} />
      </div>
    </motion.section>
  );
}
