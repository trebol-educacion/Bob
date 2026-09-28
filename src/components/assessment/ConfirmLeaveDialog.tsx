'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
  open: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * @param open boolean
 * @param onConfirm () => void
 * @param onDismiss () => void
 */
export function ConfirmLeaveDialog({ open, onConfirm, onDismiss }: Props) {
  const t = useTranslations('home.confirmLeave');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50 shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-base font-bold text-gray-800">{t('title')}</p>
            </div>
            <p className="text-sm text-gray-500 leading-snug">{t('body')}</p>
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={onDismiss}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 border border-gray-200 transition-colors"
              >
                {t('stay')}
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                {t('leave')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
