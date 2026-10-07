'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardList } from 'lucide-react';
import { MessageBubble, InfoCard } from '@/components/chat';
import { difficultyKey } from '@/components/toefl/difficulty-key';
import type { FormativeFeedback } from '@/lib/types/practice';
import type { ToeflInterviewPlan } from '@/lib/toefl/interview';

export interface InterviewSummaryProps {
  plan: ToeflInterviewPlan;
  evaluations: FormativeFeedback[];
}

/** End-of-session summary of the TOEFL interview. */
export function InterviewSummary({ plan, evaluations }: InterviewSummaryProps) {
  const t = useTranslations('toefl');
  const allHighlights = evaluations.flatMap((e) => e.highlights);
  const allSuggestions = evaluations.flatMap((e) => e.suggestions);
  return (
    <div className="space-y-4 py-2">
      <InfoCard title={t('interview.finished.sessionFeedback')} icon={ClipboardList}>
        <div className="space-y-3">
          {allHighlights.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-green-700 uppercase tracking-widest">{t('interview.finished.strengthsTitle')}</p>
              {allHighlights.map((h, i) => (
                <p key={i} className="text-sm text-green-800">✓ {h}</p>
              ))}
            </div>
          )}
          {allSuggestions.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">{t('interview.finished.focusAreas')}</p>
              {allSuggestions.map((s, i) => (
                <p key={i} className="text-sm text-amber-800">→ {s}</p>
              ))}
            </div>
          )}
        </div>
      </InfoCard>

      <div className="space-y-2">
        {plan.questions.map((q, i) => {
          const ev = evaluations[i];
          if (!ev) return null;
          return (
            <MessageBubble key={i} variant="assistant" icon={ClipboardList} accentColor="blue" noAnimate>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-bob-brand uppercase tracking-widest">
                  {t('interview.questionLabel', { n: i + 1, difficulty: t(`interview.difficulty.${difficultyKey(q.difficulty)}`) })}
                </p>
                <p className="text-sm font-bold leading-snug line-clamp-2">{q.text}</p>
                <p className={`text-xs font-bold ${ev.understood ? 'text-green-600' : 'text-amber-600'}`}>
                  {ev.understood ? t('interview.finished.messageUnderstood') : t('interview.finished.needsPractice')}
                </p>
              </div>
            </MessageBubble>
          );
        })}
      </div>
    </div>
  );
}
