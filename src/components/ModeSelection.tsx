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
import type { ModeKey, PracticeMode, CefrLevel, DynamicCard } from '@/lib/types/practice';
import { CefrLevelSelector } from '@/components/CefrLevelSelector';
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
  disabled?: boolean;
  onSelect: (mode: ModeKey) => void;
}

function ModeCard({ mode, icon, title, description, badge, officialName, disabled, onSelect, exploreLabel }: ModeCardProps & { exploreLabel: string }) {
  return (
    <motion.button
      whileHover={disabled ? {} : { y: -2 }}
      whileTap={disabled ? {} : { scale: 0.99 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={() => !disabled && onSelect(mode)}
      disabled={disabled}
      className={`bg-white border border-blue-100 hover:border-blue-200 hover:shadow-md rounded-2xl p-6 text-center transition-all duration-200 group relative flex flex-col items-center h-full w-full
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {badge && (
        <span className={`absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wide ${
          disabled
            ? 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
            : 'bg-blue-50 text-bob-brand'
        }`}>
          {badge}
        </span>
      )}
      <div className="bg-blue-50 text-bob-brand p-3.5 rounded-xl mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-extrabold text-bob-brand leading-tight tracking-tight">{title}</h3>
      <p className="text-slate-500 font-medium mt-2 text-sm leading-snug">{description}</p>
      {officialName && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-3">
          {officialName}
        </p>
      )}
      {!disabled && (
        <div className="mt-auto pt-4">
          <span className="inline-flex items-center justify-center text-sm font-bold text-bob-brand bg-blue-50 group-hover:bg-blue-100 px-4 py-1.5 rounded-full transition-colors">
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
  onCefrChange?: (level: CefrLevel | null) => void;
  organizationName?: string;
}

export const ModeSelection = forwardRef<HTMLDivElement, ModeSelectionProps>(function ModeSelection(
  { onSelect, cefrActiveLevel = null, cefrLevelLocked = false, onCefrChange, organizationName },
  selectorRef
) {
  const { allDynamicCards, enabledModes } = useOrganization();
  const t = useTranslations('home.modeSelection');

  const HIDDEN_MODES = new Set<string>(['cambridge_flyers_part1']);
  const COMING_SOON_MODES = new Set<string>(['cambridge_ket_writing_part7']);
  const enabledSet = new Set(enabledModes);
  const visibleCards = allDynamicCards.filter(card => {
    if (!enabledSet.has(card.mode_key)) return false;
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

  function renderCard(card: DynamicCard) {
    const isComingSoon = card.status === 'coming_soon' || COMING_SOON_MODES.has(card.mode_key);
    return (
      <ModeCard
        key={card.mode_key}
        mode={card.mode_key}
        icon={resolveIcon(getModeIcon(card), 26, 'text-bob-brand')}
        title={getModeTitle(card)}
        description={getModeDescription(card)}
        badge={isComingSoon ? t('comingSoon') : getModeBadge(card)}
        officialName={getModeOfficialName(card)}
        disabled={isComingSoon}
        onSelect={onSelect}
        exploreLabel={exploreLabel}
      />
    );
  }

  return (
    <div className="relative w-full min-h-full overflow-y-auto bg-white">
      <div className={`relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 ${cefrActiveLevel ? 'pt-4 pb-16' : 'min-h-full flex flex-col justify-center py-10'} space-y-10`}>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative text-center pt-2"
        >
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 14 }}
            className="relative w-40 h-40 sm:w-48 sm:h-48 mx-auto mb-4"
          >
            <BobIntroAvatar />
          </motion.div>

          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-trebol-text/45 mb-2">
            {t('tagline', { org: organizationName ? ` · ${organizationName}` : '' })}
          </p>
          <h2 className="text-4xl sm:text-5xl font-black text-trebol-text tracking-tight leading-[1.05]">
            {t('heading')}
          </h2>
          <p className="text-trebol-text/65 font-bold mt-3 text-base">
            {t('subtitle')}
          </p>
        </motion.div>

        <motion.div
          ref={selectorRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex justify-center"
        >
          <CefrLevelSelector
            value={cefrActiveLevel}
            onChange={onCefrChange ?? (() => {})}
            onClear={onCefrChange ? () => onCefrChange(null) : undefined}
            disabled={!onCefrChange}
            locked={cefrLevelLocked}
          />
        </motion.div>

        {!cefrActiveLevel && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="text-center"
          >
            <p className="text-sm sm:text-base font-bold text-trebol-text/65 max-w-md mx-auto">
              {t('pickLevelHint')}
            </p>
          </motion.div>
        )}

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
