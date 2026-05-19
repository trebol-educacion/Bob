import React, { forwardRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import {
  MessageSquare,
  Image as ImageIcon,
  Sparkles,
  Mic2,
  Headphones,
  ClipboardList,
  Hand,
  HelpCircle,
  BookOpen,
  User,
  GitCompare,
  MessageCircle,
  BookImage,
} from 'lucide-react';
import type { ModeKey, PracticeMode, CefrLevel, DynamicCard, CardVisibility } from '@/lib/types/practice';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { AvailableMode } from '@/contexts/OrganizationContext';
import { getModeIcon, getModeBadge, getModeSection, getModeTitle, getModeDescription, getModeSortWeight, getModeOfficialName, isGenericGroupedWithCambridge } from '@/lib/mode-ui';
import { ListenAndPointIcon } from '@/components/icons/ModeIcons';
import { LookAndAnswerIcon, TellTheStoryIcon, WhatsThisIcon, PersonalQuestionsIcon } from '@/components/icons/StartersIcons';
import { FindTheDifferencesIcon, InformationExchangeIcon, PictureStoryMoversIcon, PersonalQuestionsMoversIcon, MoreAboutYouIcon } from '@/components/icons/MoversIcons';
import { FlyersFindDifferencesIcon } from '@/components/icons/FlyersIcons';
import { KETListeningIcon, KETReadingIcon, KETWritingIcon, KETSpeakingIcon } from '@/components/icons/KETIcons';
import { PETListeningIcon, PETReadingIcon, PETWritingIcon, PETSpeakingIcon } from '@/components/icons/PETIcons';
import { FCEListeningIcon, FCEReadingIcon, FCEWritingIcon, FCESpeakingIcon } from '@/components/icons/FCEIcons';
import { CAEInterviewIcon, CAELongTurnIcon, CAECollaborativeIcon, CAEDiscussionIcon } from '@/components/icons/CAEIcons';
import { CPEInterviewIcon, CPECollaborativeIcon, CPEMonologueIcon, CPEExtendedDiscussionIcon, CPEFinalDiscussionIcon } from '@/components/icons/CPEIcons';

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  MessageSquare,
  Image: ImageIcon,
  Sparkles,
  Mic2,
  Headphones,
  ClipboardList,
  Hand,
  HelpCircle,
  BookOpen,
  User,
  GitCompare,
  MessageCircle,
  BookImage,
  ImageIcon,
  ListenAndPoint: ListenAndPointIcon,
  LookAndAnswer: LookAndAnswerIcon,
  TellTheStory: TellTheStoryIcon,
  WhatsThis: WhatsThisIcon,
  PersonalQuestions: PersonalQuestionsIcon,
  FindTheDifferences: FindTheDifferencesIcon,
  InformationExchange: InformationExchangeIcon,
  PictureStoryMovers: PictureStoryMoversIcon,
  PersonalQuestionsMovers: PersonalQuestionsMoversIcon,
  MoreAboutYou: MoreAboutYouIcon,
  FlyersFindDifferences: FlyersFindDifferencesIcon,
  KETListening: KETListeningIcon,
  KETReading: KETReadingIcon,
  KETWriting: KETWritingIcon,
  KETSpeaking: KETSpeakingIcon,
  PETListening: PETListeningIcon,
  PETReading: PETReadingIcon,
  PETWriting: PETWritingIcon,
  PETSpeaking: PETSpeakingIcon,
  FCEListening: FCEListeningIcon,
  FCEReading: FCEReadingIcon,
  FCEWriting: FCEWritingIcon,
  FCESpeaking: FCESpeakingIcon,
  CAEInterview: CAEInterviewIcon,
  CAELongTurn: CAELongTurnIcon,
  CAECollaborative: CAECollaborativeIcon,
  CAEDiscussion: CAEDiscussionIcon,
  CPEInterview: CPEInterviewIcon,
  CPECollaborative: CPECollaborativeIcon,
  CPEMonologue: CPEMonologueIcon,
  CPEExtendedDiscussion: CPEExtendedDiscussionIcon,
  CPEFinalDiscussion: CPEFinalDiscussionIcon,
};

function resolveIcon(name: string, size = 28, className?: string): React.ReactNode {
  const Icon = ICON_MAP[name];
  if (Icon) return <Icon size={size} className={className} />;
  return <Sparkles size={size} className={className} />;
}

interface ModeCardProps {
  mode: ModeKey;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  officialName?: string;
  visibility: CardVisibility;
  tooltip?: string;
  onSelect: (mode: ModeKey) => void;
}

function ModeCard({ mode, icon, title, description, badge, officialName, visibility, tooltip, onSelect, exploreLabel }: ModeCardProps & { exploreLabel: string }) {
  const isDisabled = visibility !== 'enabled';
  return (
    <motion.button
      whileHover={isDisabled ? {} : { y: -2 }}
      whileTap={isDisabled ? {} : { scale: 0.99 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={() => !isDisabled && onSelect(mode)}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      title={tooltip}
      className={`bg-white border hover:shadow-md rounded-2xl p-6 text-center transition-all duration-200 group relative flex flex-col items-center h-full w-full
        border-[color-mix(in_oklab,var(--color-bob-brand)_15%,white)]
        hover:border-[color-mix(in_oklab,var(--color-bob-brand)_28%,white)]
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {badge && (
        <span className="absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wide text-bob-brand bg-[color-mix(in_oklab,var(--color-bob-brand)_10%,white)]">
          {badge}
        </span>
      )}
      <div className="text-bob-brand p-3.5 rounded-xl mb-4 bg-[color-mix(in_oklab,var(--color-bob-brand)_10%,white)]">
        {icon}
      </div>
      <h3 className="text-lg font-extrabold text-bob-brand leading-tight tracking-tight">{title}</h3>
      <p className="text-slate-500 font-medium mt-2 text-sm leading-snug">{description}</p>
      {officialName && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-3">
          {officialName}
        </p>
      )}
      {!isDisabled && (
        <div className="mt-auto pt-4">
          <span className="inline-flex items-center justify-center text-sm font-bold text-bob-brand px-4 py-1.5 rounded-full transition-colors
            bg-[color-mix(in_oklab,var(--color-bob-brand)_10%,white)]
            group-hover:bg-[color-mix(in_oklab,var(--color-bob-brand)_18%,white)]">
            {exploreLabel}
          </span>
        </div>
      )}
    </motion.button>
  );
}

/**
 * Plays the Bob greeting video once on first load, then swaps to the
 * static avatar PNG. Avoids continuous CPU drain from looping playback.
 */
function BobIntroAvatar() {
  const [videoEnded, setVideoEnded] = useState(false);

  return (
    <div className="relative w-full h-full rounded-full bg-white shadow-xl ring-4 ring-white overflow-hidden">
      <motion.div
        animate={{ rotate: [0, -6, 6, -4, 0] }}
        transition={{ delay: 0.7, duration: 1.4, ease: 'easeInOut' }}
        className="w-full h-full relative"
        style={{ transformOrigin: '50% 80%' }}
      >
        <Image
          src="/bob_avatar.png"
          alt="Bob"
          fill
          sizes="160px"
          className="object-cover object-[50%_0%] scale-95 origin-bottom"
          priority
        />
      </motion.div>
      {!videoEnded && (
        <video
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={() => setVideoEnded(true)}
          onError={() => setVideoEnded(true)}
          className="absolute inset-0 w-full h-full object-cover object-[50%_35%]"
        >
          <source src="/bob_hello.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}

interface ModeSelectionProps {
  onSelect: (mode: PracticeMode) => void;
  enabledModes?: ModeKey[];
  availableModes?: AvailableMode[];
  cefrActiveLevel?: CefrLevel | null;
  cefrLevelLocked?: boolean;
  organizationName?: string;
}

export const ModeSelection = forwardRef<HTMLDivElement, ModeSelectionProps>(function ModeSelection(
  { onSelect, cefrActiveLevel = null },
  selectorRef
) {
  const { allDynamicCards, resolvedCards } = useOrganization();
  const t = useTranslations('home.modeSelection');

  const HIDDEN_MODES = new Set<string>(['cambridge_flyers_part1']);
  const resolvedCardMap = new Map(resolvedCards.map(rc => [rc.mode_key, rc]));

  const visibleCards = allDynamicCards.filter(card => {
    const resolved = resolvedCardMap.get(card.mode_key);
    if (!resolved) return false;
    if (resolved.visibility !== 'enabled') return false;
    if (HIDDEN_MODES.has(card.mode_key)) return false;
    if (card.framework === 'generic' && card.cefr_level !== null) {
      if (card.cefr_level !== cefrActiveLevel) return false;
    }
    return true;
  });

  const genericCards = visibleCards.filter(
    card => card.framework === 'generic' && !isGenericGroupedWithCambridge(card),
  );
  const frameworkCards = visibleCards.filter(
    card => card.framework !== 'generic' || isGenericGroupedWithCambridge(card),
  );

  const showFreePractice = frameworkCards.length === 0;

  const sectionMap = new Map<string, DynamicCard[]>();
  for (const card of frameworkCards) {
    const section = getModeSection(card);
    const existing = sectionMap.get(section) ?? [];
    existing.push(card);
    sectionMap.set(section, existing);
  }
  for (const cards of sectionMap.values()) {
    cards.sort((a, b) => getModeSortWeight(a) - getModeSortWeight(b));
  }

  const exploreLabel = t('explore');

  function resolveTooltip(visibility: CardVisibility, card: DynamicCard): string | undefined {
    if (visibility === 'disabled-mismatch') {
      const level = card.cefr_level?.toUpperCase() ?? '';
      return t('availableForLevel', { level });
    }
    if (visibility === 'disabled-not-available') {
      return t('notAvailableYet');
    }
    return undefined;
  }

  function renderCard(card: DynamicCard) {
    const resolved = resolvedCardMap.get(card.mode_key);
    const visibility: CardVisibility = resolved?.visibility ?? 'enabled';
    const tooltip = resolveTooltip(visibility, card);
    return (
      <ModeCard
        key={card.mode_key}
        mode={card.mode_key}
        icon={resolveIcon(getModeIcon(card), 26, 'text-bob-brand')}
        title={getModeTitle(card)}
        description={getModeDescription(card)}
        badge={getModeBadge(card)}
        officialName={getModeOfficialName(card)}
        visibility={visibility}
        tooltip={tooltip}
        onSelect={onSelect}
        exploreLabel={exploreLabel}
      />
    );
  }

  return (
    <div className="relative w-full min-h-full overflow-y-auto bg-white">
      <div ref={selectorRef} className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-4 pb-16 space-y-10">
        {cefrActiveLevel && showFreePractice && genericCards.length > 0 && (
          <motion.div
            key={`generic-${cefrActiveLevel}`}
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
              {genericCards.map((card, idx) => (
                <motion.div
                  key={card.mode_key}
                  className="h-full"
                  variants={{
                    hidden: { opacity: 0, y: 24, scale: 0.94 },
                    show: { opacity: 1, y: 0, scale: 1 },
                  }}
                  transition={{ type: 'spring', stiffness: 220, damping: 22, delay: idx * 0.02 }}
                >
                  {renderCard(card)}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {cefrActiveLevel && Array.from(sectionMap.entries()).map(([sectionName, cards], i) => (
          <motion.div
            key={`${sectionName}-${cefrActiveLevel}`}
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 + i * 0.08 } },
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
              {cards.map((card) => (
                <motion.div
                  key={card.mode_key}
                  className="h-full"
                  variants={{
                    hidden: { opacity: 0, y: 28, scale: 0.92 },
                    show: { opacity: 1, y: 0, scale: 1 },
                  }}
                  transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                >
                  {renderCard(card)}
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
});
