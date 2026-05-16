import React, { forwardRef } from 'react';
import { motion } from 'motion/react';
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
import { getModeIcon, getModeBadge, getModeSection, getModeTitle, getModeDescription, getModeSortWeight, getModeOfficialName, getYLCardTheme, type YLCardTheme } from '@/lib/mode-ui';
import { ListenAndPointIcon } from '@/components/icons/ModeIcons';

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
  theme?: YLCardTheme | null;
  disabled?: boolean;
  onSelect: (mode: ModeKey) => void;
}

function ModeCard({ mode, icon, title, description, badge, officialName, theme, disabled, onSelect }: ModeCardProps) {
  if (theme) {
    return (
      <motion.button
        whileHover={disabled ? {} : { y: -2 }}
        whileTap={disabled ? {} : { scale: 0.99 }}
        onClick={() => !disabled && onSelect(mode)}
        disabled={disabled}
        className={`font-nunito ${theme.cardBg} ${theme.cardRing} shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-md rounded-2xl p-6 text-left space-y-4 transition-all duration-200 group relative overflow-hidden
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className={`${theme.iconBg} ${theme.iconText} p-3.5 rounded-xl w-fit transition-colors duration-200`}>
            {icon}
          </div>
          {badge && (
            <span className={`text-[11px] font-bold ${theme.badgeBg} ${theme.badgeText} px-2.5 py-1 rounded-full shrink-0 tracking-wide`}>
              {badge}
            </span>
          )}
        </div>
        <div>
          <h3 className={`text-xl font-extrabold ${theme.titleText} leading-tight tracking-tight`}>{title}</h3>
          <p className="text-slate-500 font-medium mt-2 text-sm leading-snug">{description}</p>
          {officialName && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-3">
              {officialName}
            </p>
          )}
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      onClick={() => !disabled && onSelect(mode)}
      disabled={disabled}
      className={`bg-white shadow-md rounded-xl p-6 text-left space-y-3 hover:shadow-lg transition-shadow group relative overflow-hidden
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="flex items-start justify-between">
        <div className="bg-trebol-secondary/20 p-3 rounded-lg w-fit group-hover:bg-trebol-primary group-hover:text-white transition-colors">
          {icon}
        </div>
        {badge && (
          <span className="text-xs font-bold text-trebol-primary bg-trebol-secondary/20 px-2 py-1 rounded-full shrink-0">
            {badge}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-lg font-black text-trebol-text">{title}</h3>
        <p className="text-trebol-text opacity-70 font-medium mt-1 text-sm">{description}</p>
        {officialName && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-trebol-text/40 mt-2">
            {officialName}
          </p>
        )}
      </div>
      <Sparkles className="absolute -bottom-4 -right-4 text-trebol-secondary opacity-10 group-hover:opacity-30 transition-opacity" size={80} />
    </motion.button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-trebol-text/50 uppercase tracking-widest mb-3">
      {children}
    </h3>
  );
}

interface ModeSelectionProps {
  onSelect: (mode: PracticeMode) => void;
  enabledModes?: ModeKey[];
  availableModes?: AvailableMode[];
  cefrActiveLevel?: CefrLevel | null;
  cefrLevelLocked?: boolean;
  onCefrChange?: (level: CefrLevel) => void;
}

export const ModeSelection = forwardRef<HTMLDivElement, ModeSelectionProps>(function ModeSelection(
  { onSelect, cefrActiveLevel = null, cefrLevelLocked = false, onCefrChange },
  selectorRef
) {
  const { allDynamicCards, enabledModes } = useOrganization();
  const iconClass = 'text-trebol-primary group-hover:text-white transition-colors';

  const enabledSet = new Set(enabledModes);
  const visibleCards = allDynamicCards.filter(card => enabledSet.has(card.mode_key));

  const genericCards = visibleCards.filter(card => card.framework === 'generic');
  const frameworkCards = visibleCards.filter(card => card.framework !== 'generic');

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

  function renderCard(card: DynamicCard) {
    const ylTheme = getYLCardTheme(card);
    const iconColorClass = ylTheme
      ? `${ylTheme.iconText} transition-colors duration-200`
      : iconClass;
    return (
      <ModeCard
        key={card.mode_key}
        mode={card.mode_key}
        icon={resolveIcon(getModeIcon(card), 28, iconColorClass)}
        title={getModeTitle(card)}
        description={getModeDescription(card)}
        badge={getModeBadge(card)}
        officialName={getModeOfficialName(card)}
        theme={ylTheme}
        onSelect={onSelect}
      />
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 pb-12 space-y-8 overflow-y-auto">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-trebol-text tracking-tight">
          Elige tu entrenamiento
        </h2>
        <p className="text-trebol-text font-semibold opacity-60">
          ¿Cómo quieres mejorar tu inglés hoy?
        </p>
      </div>

      <div ref={selectorRef} className="flex justify-center">
        <CefrLevelSelector
          value={cefrActiveLevel}
          onChange={onCefrChange ?? (() => {})}
          disabled={!onCefrChange}
          locked={cefrLevelLocked}
        />
      </div>

      {showFreePractice && genericCards.length > 0 && (
        <div>
          <SectionTitle>Free Practice</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {genericCards.map(renderCard)}
          </div>
        </div>
      )}

      {Array.from(sectionMap.entries()).map(([sectionName, cards]) => (
        <div key={sectionName}>
          <SectionTitle>{sectionName}</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map(renderCard)}
          </div>
        </div>
      ))}
    </div>
  );
});
