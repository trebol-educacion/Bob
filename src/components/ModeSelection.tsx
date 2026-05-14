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
import type { ModeKey, PracticeMode, CefrLevel } from '@/lib/types/practice';
import { MODE_UI_METADATA } from '@/lib/types/practice';
import { CefrLevelSelector } from '@/components/CefrLevelSelector';
import type { AvailableMode } from '@/contexts/OrganizationContext';

// ---------------------------------------------------------------------------
// Icon resolver — maps lucide icon name string → JSX element
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Friendly section names for frameworks
// ---------------------------------------------------------------------------

const FRAMEWORK_SECTION: Record<string, string> = {
  cambridge: 'Cambridge English',
  toefl: 'TOEFL iBT',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ModeSelection props
// ---------------------------------------------------------------------------

interface ModeSelectionProps {
  onSelect: (mode: PracticeMode) => void;
  enabledModes?: PracticeMode[];
  /** DB-driven modes from OrganizationContext — used as fallback display data */
  availableModes?: AvailableMode[];
  cefrActiveLevel?: CefrLevel | null;
  cefrLevelLocked?: boolean;
  onCefrChange?: (level: CefrLevel) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ModeSelection = forwardRef<HTMLDivElement, ModeSelectionProps>(function ModeSelection(
  { onSelect, enabledModes = [], availableModes = [], cefrActiveLevel = null, cefrLevelLocked = false, onCefrChange },
  selectorRef
) {
  const iconClass = 'text-trebol-primary group-hover:text-white transition-colors';

  // Separate generic modes from framework modes
  const genericEnabled = enabledModes.filter(
    (m): m is ModeKey => m !== null && (m as string).startsWith('generic_')
  );
  const frameworkEnabled = enabledModes.filter(
    (m): m is ModeKey => m !== null && !(m as string).startsWith('generic_')
  );

  // Free Practice section is only shown when there are no framework modes.
  // resolveEnabledModes already removes generic modes when frameworks are assigned,
  // so genericEnabled will be empty when frameworkEnabled is non-empty.
  const showFreePractice = frameworkEnabled.length === 0;

  // Build an index from availableModes for O(1) fallback display data lookup
  // key: `${framework}_${exam_part}` (matches PracticeMode pattern)
  const availableModeIndex = new Map<string, AvailableMode>();
  for (const am of availableModes) {
    const key = `${am.framework}_${am.exam_part}`;
    if (!availableModeIndex.has(key)) availableModeIndex.set(key, am);
  }

  // Group framework modes by their section name
  const sectionMap = new Map<string, ModeKey[]>();
  for (const mode of frameworkEnabled) {
    const meta = MODE_UI_METADATA[mode];
    // Determine section name: prefer metadata, then derive from framework prefix, then fallback
    let sectionName: string;
    if (meta?.section) {
      sectionName = meta.section;
    } else {
      // Derive framework from mode key prefix (e.g. 'cambridge_...' → 'cambridge')
      const framework = (mode as string).split('_')[0];
      sectionName = FRAMEWORK_SECTION[framework] ?? 'Other';
    }
    const existing = sectionMap.get(sectionName) ?? [];
    existing.push(mode);
    sectionMap.set(sectionName, existing);
  }

  // Render a single card for a framework mode
  function renderFrameworkCard(mode: ModeKey) {
    const meta = MODE_UI_METADATA[mode];
    const amFallback = availableModeIndex.get(mode as string);

    if (meta) {
      return (
        <ModeCard
          key={mode}
          mode={mode}
          icon={resolveIcon(meta.icon, 28, iconClass)}
          title={meta.title}
          description={meta.description}
          badge={meta.badge}
          onSelect={onSelect}
        />
      );
    }

    // Fallback: use availableModes data or generic presentation
    const title = amFallback?.label ?? mode;
    const description = amFallback?.description ?? '';
    const cefrBadge = amFallback?.cefr_level
      ? `${amFallback.cefr_level.toUpperCase()} · ${amFallback.exam_part}`
      : amFallback?.exam_part ?? '';

    return (
      <ModeCard
        key={mode}
        mode={mode}
        icon={<Sparkles size={28} className={iconClass} />}
        title={title}
        description={description}
        badge={cefrBadge || undefined}
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

      {/* CEFR Level Selector */}
      <div ref={selectorRef} className="flex justify-center">
        <CefrLevelSelector
          value={cefrActiveLevel}
          onChange={onCefrChange ?? (() => {})}
          disabled={!onCefrChange}
          locked={cefrLevelLocked}
        />
      </div>

      {/* Free Practice — shown only when no framework modes are active */}
      {showFreePractice && (
        <div>
          <SectionTitle>Free Practice</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ModeCard
              mode="generic_situation"
              icon={<MessageSquare size={28} className={iconClass} />}
              title="Práctica de Situación"
              description="Practica frases útiles para situaciones reales personalizadas por ti."
              onSelect={onSelect}
            />
            <ModeCard
              mode="generic_image"
              icon={<ImageIcon size={28} className={iconClass} />}
              title="Descripción de Imagen"
              description="Prepárate para el examen B1 describiendo escenas generadas por IA."
              onSelect={onSelect}
            />
            <ModeCard
              mode="generic_conversation"
              icon={<Mic2 size={28} className={iconClass} />}
              title="Conversación Fluida"
              description="Interactúa en una conversación real con IA sobre cualquier tema."
              onSelect={onSelect}
            />
          </div>
        </div>
      )}

      {/* Dynamic framework sections */}
      {Array.from(sectionMap.entries()).map(([sectionName, modes]) => (
        <div key={sectionName}>
          <SectionTitle>{sectionName}</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {modes.map(renderFrameworkCard)}
          </div>
        </div>
      ))}
    </div>
  );
});
