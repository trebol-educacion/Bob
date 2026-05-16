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
import { getModeIcon, getModeBadge, getModeSection, getModeTitle, getModeDescription } from '@/lib/mode-ui';

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
  disabled?: boolean;
  onSelect: (mode: ModeKey) => void;
}

function ModeCard({ mode, icon, title, description, badge, disabled, onSelect }: ModeCardProps) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      onClick={() => !disabled && onSelect(mode)}
      disabled={disabled}
      className={`bg-white shadow-md rounded-xl p-6 text-left space-y-3 hover:shadow-lg transition-shadow group relative overflow-hidden
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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

  function renderCard(card: DynamicCard) {
    return (
      <ModeCard
        key={card.mode_key}
        mode={card.mode_key}
        icon={resolveIcon(getModeIcon(card), 28, iconClass)}
        title={getModeTitle(card)}
        description={getModeDescription(card)}
        badge={getModeBadge(card)}
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
