'use client';

import React from 'react';
import { MessageSquare, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ChatShell } from '@/components/ChatShell';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import type { FormativeFeedback } from '@/lib/types/practice';
import { CollaborativeBackButton } from './CollaborativeBackButton';
import { CollaborativeFeedbackPanel } from './CollaborativeFeedbackPanel';

interface ResultProps {
  feedback: FormativeFeedback;
  onTryAgain: () => void;
  onBack: () => void;
}

export function CollaborativeResult({ feedback, onTryAgain, onBack }: ResultProps) {
  const t = useTranslations('cambridge');

  const inputSlot = (
    <div className="flex-none border-t border-gray-100 bg-white px-4 py-4 flex gap-3">
      <button
        onClick={onTryAgain}
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-trebol-primary text-trebol-primary font-bold hover:bg-trebol-primary/5 transition-colors"
      >
        <RotateCcw size={16} />
        {t('common.tryAgain')}
      </button>
      <button
        onClick={onBack}
        className="flex-1 py-3 rounded-xl bg-trebol-primary text-white font-bold hover:opacity-90 transition-opacity"
      >
        {t('common.backToModes')}
      </button>
    </div>
  );

  return (
    <ChatShell
      headerConfig={{
        icon: MessageSquare,
        title: t('b1.collaborative.feedbackTitle'),
        subtitle: t('b1.collaborative.headerSubtitle'),
        accentColor: 'blue',
        online: false,
        leftSlot: <CollaborativeBackButton onBack={onBack} />,
      }}
      footerConfig={{ modeLabel: t('b1.collaborative.footerFeedbackLabel'), modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={inputSlot}
      animationKey="b1-result"
    >
      <CollaborativeFeedbackPanel feedback={feedback} />
    </ChatShell>
  );
}
