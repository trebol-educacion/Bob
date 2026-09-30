'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Loader2, MessageSquare, Shuffle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ChatShell } from '@/components/ChatShell';
import { MessageBubble, InfoCard } from '@/components/chat';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import type { Part3Scenario } from '@/lib/speaking/types';
import { CollaborativeBackButton } from './CollaborativeBackButton';

interface IntroProps {
  presets: Part3Scenario[];
  scenario: Part3Scenario | null;
  loadingScenario: boolean;
  maxTurns: number;
  onSelectPreset: (preset: Part3Scenario) => void;
  onSurpriseMe: () => void;
  onStart: () => void;
  onBack: () => void;
}

export function CollaborativeIntro(props: IntroProps) {
  const t = useTranslations('cambridge');
  const { presets, scenario, loadingScenario } = props;

  const inputSlot = (
    <div className="flex-none border-t border-gray-100 bg-white px-4 py-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {presets.map((preset) => (
          <button
            key={preset.topic}
            onClick={() => props.onSelectPreset(preset)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              scenario?.topic === preset.topic
                ? 'border-trebol-primary bg-trebol-primary/5'
                : 'border-gray-200 hover:border-trebol-secondary bg-white'
            }`}
          >
            <p className="font-bold text-trebol-text text-sm">{preset.topic}</p>
            <p className="text-xs text-trebol-text/60 mt-1 line-clamp-2">{preset.situation}</p>
          </button>
        ))}
      </div>

      <button
        onClick={props.onSurpriseMe}
        disabled={loadingScenario}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-trebol-secondary/50 text-trebol-primary font-semibold hover:bg-trebol-secondary/10 transition-colors disabled:opacity-50"
      >
        <span className="flex items-center justify-center w-4 h-4">
          {loadingScenario ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />}
        </span>
        {loadingScenario ? t('b1.collaborative.generatingScenario') : t('b1.collaborative.surpriseMe')}
      </button>

      <AnimatePresence>
        {scenario && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <div className="flex flex-wrap gap-2">
              {scenario.options.map((opt) => (
                <span
                  key={opt}
                  className="text-xs bg-trebol-secondary/20 text-trebol-text/80 px-2 py-1 rounded-full font-medium"
                >
                  {opt}
                </span>
              ))}
            </div>
            <button
              onClick={props.onStart}
              className="w-full bg-trebol-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              {t('b1.collaborative.startDiscussion')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const body = (
    <div className="space-y-4">
      <MessageBubble variant="assistant" icon={MessageSquare} accentColor="blue" noAnimate>
        <p className="font-semibold">{t('b1.collaborative.howItWorks')}</p>
        <ul className="mt-2 space-y-1 text-sm">
          <li className="flex items-start gap-2">
            <ChevronRight size={14} className="mt-0.5 shrink-0" />
            {t('b1.collaborative.howItWorksLine1', { maxTurns: props.maxTurns })}
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight size={14} className="mt-0.5 shrink-0" />
            {t('b1.collaborative.howItWorksLine2')}
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight size={14} className="mt-0.5 shrink-0" />
            {t('b1.collaborative.howItWorksLine3')}
          </li>
        </ul>
      </MessageBubble>

      {scenario && (
        <InfoCard title={scenario.topic} icon={MessageSquare}>
          <p>{scenario.situation}</p>
          <p className="mt-1 font-semibold text-amber-900">{scenario.prompt_question}</p>
        </InfoCard>
      )}
    </div>
  );

  return (
    <ChatShell
      headerConfig={{
        icon: MessageSquare,
        title: t('b1.collaborative.headerTitle'),
        subtitle: t('b1.collaborative.headerSubtitle'),
        accentColor: 'blue',
        online: true,
        leftSlot: <CollaborativeBackButton onBack={props.onBack} />,
      }}
      footerConfig={{ modeLabel: t('b1.collaborative.footerModeLabel'), modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={inputSlot}
      animationKey="b1-intro"
    >
      {body}
    </ChatShell>
  );
}
