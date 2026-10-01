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
  translationScope: string;
  onTryAgain: () => void;
  onBack: () => void;
}

export function CollaborativeResult({ feedback, translationScope, onTryAgain, onBack }: ResultProps) {
  const tc = useTranslations('cambridge');
  const t = (key: string) => tc(`${translationScope}.${key}`);

  const inputSlot = (
    <div className="flex-none border-t border-gray-100 bg-white px-4 py-4 flex gap-3">
      <button
        onClick={onTryAgain}
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-trebol-primary text-trebol-primary font-bold hover:bg-trebol-primary/5 transition-colors"
      >
        <RotateCcw size={16} />
        {tc('common.tryAgain')}
      </button>
      <button
        onClick={onBack}
        className="flex-1 py-3 rounded-xl bg-trebol-primary text-white font-bold hover:opacity-90 transition-opacity"
      >
        {tc('common.backToModes')}
      </button>
    </div>
  );

  return (
    <ChatShell
      headerConfig={{
        icon: MessageSquare,
        title: t('feedbackTitle'),
        subtitle: t('headerSubtitle'),
        accentColor: 'blue',
        online: false,
        leftSlot: <CollaborativeBackButton onBack={onBack} />,
      }}
      footerConfig={{ modeLabel: t('footerFeedbackLabel'), modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={inputSlot}
      animationKey="b1-result"
    >
      <CollaborativeFeedbackPanel feedback={feedback} />
    </ChatShell>
  );
}
