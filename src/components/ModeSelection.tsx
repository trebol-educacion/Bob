import React, { forwardRef } from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Image as ImageIcon, Sparkles, Mic2, Users, BookOpen, Headphones, ClipboardList, FileText } from 'lucide-react';
import type { ModeKey, PracticeMode, CefrLevel } from '@/lib/types/practice';
import { CefrLevelSelector } from '@/components/CefrLevelSelector';

interface ModeSelectionProps {
  onSelect: (mode: PracticeMode) => void;
  enabledModes?: PracticeMode[];
  cefrActiveLevel?: CefrLevel | null;
  cefrLevelLocked?: boolean;
  onCefrChange?: (level: CefrLevel) => void;
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

export const ModeSelection = forwardRef<HTMLDivElement, ModeSelectionProps>(function ModeSelection(
  { onSelect, enabledModes, cefrActiveLevel = null, cefrLevelLocked = false, onCefrChange },
  selectorRef
) {
  const isDisabled = (mode: ModeKey) =>
    enabledModes !== undefined && !enabledModes.includes(mode);

  const iconClass = "text-trebol-primary group-hover:text-white transition-colors";

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

      {/* Free Practice */}
      <div>
        <SectionTitle>Free Practice</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModeCard
            mode="generic_situation"
            icon={<MessageSquare size={28} className={iconClass} />}
            title="Práctica de Situación"
            description="Practica frases útiles para situaciones reales personalizadas por ti."
            disabled={isDisabled('generic_situation')}
            onSelect={onSelect}
          />
          <ModeCard
            mode="generic_image"
            icon={<ImageIcon size={28} className={iconClass} />}
            title="Descripción de Imagen"
            description="Prepárate para el examen B1 describiendo escenas generadas por IA."
            disabled={isDisabled('generic_image')}
            onSelect={onSelect}
          />
          <ModeCard
            mode="generic_conversation"
            icon={<Mic2 size={28} className={iconClass} />}
            title="Conversación Fluida"
            description="Interactúa en una conversación real con IA sobre cualquier tema."
            disabled={isDisabled('generic_conversation')}
            onSelect={onSelect}
          />
        </div>
      </div>

      {/* Cambridge English */}
      <div>
        <SectionTitle>Cambridge English</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModeCard
            mode="cambridge_pet_p3"
            icon={<Users size={28} className={iconClass} />}
            title="B1 Collaborative Task"
            description="Discuss &amp; decide together"
            badge="B1 · 10 min"
            disabled={isDisabled('cambridge_pet_p3')}
            onSelect={onSelect}
          />
          <ModeCard
            mode="cambridge_ket_part1"
            icon={<BookOpen size={28} className={iconClass} />}
            title="A2 Key Speaking"
            description="Answer questions from an examiner"
            badge="A2 · 8 min"
            disabled={isDisabled('cambridge_ket_part1')}
            onSelect={onSelect}
          />
          <ModeCard
            mode="cambridge_fce_p1"
            icon={<FileText size={28} className={iconClass} />}
            title="B2 First Speaking"
            description="Describe &amp; compare photos"
            badge="B2 · 5 min"
            disabled={isDisabled('cambridge_fce_p1')}
            onSelect={onSelect}
          />
        </div>
      </div>

      {/* TOEFL iBT */}
      <div>
        <SectionTitle>TOEFL iBT</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModeCard
            mode="toefl_listen_repeat"
            icon={<Headphones size={28} className={iconClass} />}
            title="Listen &amp; Repeat"
            description="Repeat what you hear clearly"
            badge="TOEFL · 10 min"
            disabled={isDisabled('toefl_listen_repeat')}
            onSelect={onSelect}
          />
          <ModeCard
            mode="toefl_interview"
            icon={<ClipboardList size={28} className={iconClass} />}
            title="Take an Interview"
            description="Answer topic questions under time"
            badge="TOEFL · 8 min"
            disabled={isDisabled('toefl_interview')}
            onSelect={onSelect}
          />
        </div>
      </div>
    </div>
  );
});
