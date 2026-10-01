'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Mic } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { KETSpeakingIcon } from '@/components/icons/KETIcons';
import type { FormativeFeedback } from '@/lib/types/practice';
import { FeedbackBlocks } from './FeedbackBlocks';
import { ACCENT, ACCENT_DARK, ACCENT_TINT, CARD_SURFACE } from './speaking-theme';

interface HeaderProps {
  title: string;
  subtitle: string;
  levelBadge: string;
  onBack: () => void;
}

export function QuestionRoundHeader({ title, subtitle, levelBadge, onBack }: HeaderProps) {
  const t = useTranslations('cambridge');
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
      <button
        type="button"
        onClick={onBack}
        className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 text-lg"
        aria-label={t('common.back')}
      >
        ←
      </button>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT_TINT, color: ACCENT }}>
        <KETSpeakingIcon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">{title}</p>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: ACCENT_TINT, color: ACCENT_DARK }}>
        {levelBadge}
      </span>
    </div>
  );
}

interface ErrorProps {
  header: React.ReactNode;
  message: string;
  onRetry: () => void;
  onBack: () => void;
}

export function QuestionRoundError({ header, message, onRetry, onBack }: ErrorProps) {
  const t = useTranslations('cambridge');
  return (
    <div className="flex flex-col h-full">
      {header}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <div className="mx-auto w-full max-w-lg rounded-3xl border border-gray-100 shadow-sm px-6 py-8 text-center space-y-4" style={{ background: CARD_SURFACE }}>
          <p className="text-red-500 font-semibold">{message}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="flex-1 px-5 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 active:translate-y-1"
              style={{ background: ACCENT, boxShadow: `0 4px 0 ${ACCENT_DARK}` }}
            >
              {t('common.tryAgain')}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="flex-1 px-5 py-3 rounded-2xl text-sm font-bold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              {t('common.back')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MicDeniedProps {
  header: React.ReactNode;
  onDismiss: () => void;
}

export function QuestionRoundMicDenied({ header, onDismiss }: MicDeniedProps) {
  const t = useTranslations('cambridge');
  return (
    <div className="flex flex-col h-full">
      {header}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg">
          <div className="rounded-3xl border border-gray-100 shadow-sm px-6 py-8 text-center space-y-4" style={{ background: CARD_SURFACE }}>
            <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: ACCENT_TINT, color: ACCENT }}>
              <Mic size={28} />
            </div>
            <p className="text-lg font-bold text-gray-800">We can&apos;t hear you yet</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              Ask an adult to turn on the microphone for this page, then try again.
            </p>
            <button
              type="button"
              onClick={onDismiss}
              className="px-6 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 active:translate-y-1"
              style={{ background: ACCENT, boxShadow: `0 4px 0 ${ACCENT_DARK}` }}
            >
              {t('common.tryAgain')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ResultProps {
  header: React.ReactNode;
  title: string;
  subtitle: string;
  feedback: FormativeFeedback;
  onTryAgain: () => void;
  onBack: () => void;
}

export function QuestionRoundResult({ header, title, subtitle, feedback, onTryAgain, onBack }: ResultProps) {
  const t = useTranslations('cambridge');
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex flex-col h-full">
      {header}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-lg space-y-5"
        >
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black text-gray-900">{title}</h2>
            <p className="text-sm text-gray-400 font-medium">{subtitle}</p>
          </div>

          <FeedbackBlocks feedback={feedback} />

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onTryAgain}
              className="flex-1 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 active:translate-y-1"
              style={{ background: ACCENT, boxShadow: `0 4px 0 ${ACCENT_DARK}` }}
            >
              {t('common.tryAgain')}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              {t('common.backToModes')}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
