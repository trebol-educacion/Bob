'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Shuffle } from 'lucide-react';
import { BobHeading } from '@/components/choice/BobHeading';
import { ChoiceCard } from '@/components/choice/ChoiceCard';
import { ConversationErrorBanner } from '@/components/conversation/ConversationErrorBanner';
import type { PracticeTopicsState } from '@/hooks/practice/usePracticeTopics';

export interface PracticeTopicSelectViewProps {
  topics: PracticeTopicsState;
  onSelectTopic: (slug: string) => void;
  onSurprise: () => void;
  onReload: () => void;
  onBack: () => void;
}

const SURPRISE_THEME = { color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-100' };

/** @param props PracticeTopicSelectViewProps */
export function PracticeTopicSelectView({ topics, onSelectTopic, onSurprise, onReload, onBack }: PracticeTopicSelectViewProps) {
  const t = useTranslations('practice.topicSelect');

  return (
    <div className="w-full flex-1 flex flex-col items-center py-10 px-4">
      <BobHeading size="md" className="max-w-2xl" title={t('heading')} subtitle={t('subtitle')} />

      <div className="w-full max-w-3xl space-y-8">
        <div className="max-w-xs mx-auto">
          <ChoiceCard
            theme={SURPRISE_THEME}
            icon={Shuffle}
            title={t('surprise.title')}
            subtitle={t('surprise.subtitle')}
            index={0}
            onClick={onSurprise}
          />
        </div>

        {topics.status === 'loading' && <p className="text-center text-sm text-gray-500">{t('loading')}</p>}

        {topics.status === 'error' && (
          <div className="flex justify-center">
            <ConversationErrorBanner message={t('loadError')} retryLabel={t('retry')} onRetry={onReload} />
          </div>
        )}

        {topics.status === 'ready' &&
          topics.areas.map((area) => (
            <section key={area.areaSlug} className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">{t(`areas.${area.areaSlug}`)}</h3>
              <div className="flex flex-wrap gap-3">
                {area.topics.map((topic) => (
                  <button
                    key={topic.slug}
                    type="button"
                    onClick={() => onSelectTopic(topic.slug)}
                    className="rounded-2xl border-2 border-blue-100 bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  >
                    {t(`topics.${topic.slug}`)}
                  </button>
                ))}
              </div>
            </section>
          ))}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('back')}
          </button>
        </div>
      </div>
    </div>
  );
}
