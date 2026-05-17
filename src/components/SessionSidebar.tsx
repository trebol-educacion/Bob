'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import {
  MessageSquare,
  Image as ImageIcon,
  MessagesSquare,
  Headphones,
  Mic,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { ListenAndPointIcon } from '@/components/icons/ModeIcons';
import { LookAndAnswerIcon, TellTheStoryIcon, PersonalQuestionsIcon } from '@/components/icons/StartersIcons';
import { FindTheDifferencesIcon, InformationExchangeIcon, PictureStoryMoversIcon, PersonalQuestionsMoversIcon, MoreAboutYouIcon } from '@/components/icons/MoversIcons';
import { FlyersFindDifferencesIcon } from '@/components/icons/FlyersIcons';
import { KETListeningIcon, KETReadingIcon, KETWritingIcon, KETSpeakingIcon } from '@/components/icons/KETIcons';
import { PETListeningIcon, PETReadingIcon, PETWritingIcon, PETSpeakingIcon } from '@/components/icons/PETIcons';
import { FCEListeningIcon, FCEReadingIcon, FCEWritingIcon, FCESpeakingIcon } from '@/components/icons/FCEIcons';
import { CAEInterviewIcon, CAELongTurnIcon, CAECollaborativeIcon, CAEDiscussionIcon } from '@/components/icons/CAEIcons';
import { CPEInterviewIcon, CPECollaborativeIcon, CPEMonologueIcon, CPEExtendedDiscussionIcon, CPEFinalDiscussionIcon } from '@/components/icons/CPEIcons';
import { BobSession, SessionMode } from '@/actions/sessions';
import { cn } from '@/lib/utils';

interface SessionSidebarProps {
  sessions: BobSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  loading?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

const MODE_ICON: Record<NonNullable<SessionMode>, React.ElementType> = {
  generic_situation: MessageSquare,
  generic_image: ImageIcon,
  generic_conversation: MessagesSquare,
  cambridge_starters_part1: ListenAndPointIcon,
  cambridge_starters_part2: LookAndAnswerIcon,
  cambridge_starters_part3: TellTheStoryIcon,
  cambridge_starters_part4: PersonalQuestionsIcon,
  cambridge_movers_part1: FindTheDifferencesIcon,
  cambridge_movers_part2: InformationExchangeIcon,
  cambridge_movers_part3: PictureStoryMoversIcon,
  cambridge_movers_part4: PersonalQuestionsMoversIcon,
  cambridge_movers_part5: MoreAboutYouIcon,
  cambridge_flyers_part1: FlyersFindDifferencesIcon,
  cambridge_ket_part1: KETSpeakingIcon,
  cambridge_ket_part2: KETSpeakingIcon,
  cambridge_pet_p1: PETSpeakingIcon,
  cambridge_pet_p2: PETSpeakingIcon,
  cambridge_pet_p3: PETSpeakingIcon,
  cambridge_pet_p4: PETSpeakingIcon,
  cambridge_fce_p1: FCESpeakingIcon,
  cambridge_fce_p2: FCESpeakingIcon,
  cambridge_fce_p3: FCESpeakingIcon,
  cambridge_fce_p4: FCESpeakingIcon,
  cambridge_cae_p1: CAEInterviewIcon,
  cambridge_cae_p2: CAELongTurnIcon,
  cambridge_cae_p3: CAECollaborativeIcon,
  cambridge_cae_p4: CAEDiscussionIcon,
  cambridge_cpe_p1: CPEInterviewIcon,
  cambridge_cpe_p2: CPECollaborativeIcon,
  cambridge_cpe_p3a: CPEMonologueIcon,
  cambridge_cpe_p3b: CPEExtendedDiscussionIcon,
  cambridge_cpe_p4: CPEFinalDiscussionIcon,
  toefl_listen_repeat: Headphones,
  toefl_interview: Mic,
};

interface FrameworkAccent {
  color: string;
  soft: string;
  glow: string;
}

function modeAccent(mode: SessionMode | null | undefined): FrameworkAccent {
  if (!mode) return { color: '#1E1E1C', soft: '#e5e5e2', glow: 'rgba(30,30,28,0.18)' };
  if (mode.includes('starters') || mode.includes('movers') || mode.includes('flyers')) {
    return { color: '#469E7B', soft: '#dcebe3', glow: 'rgba(70,158,123,0.22)' };
  }
  if (mode.includes('ket')) return { color: '#3660AB', soft: '#dde4f2', glow: 'rgba(54,96,171,0.22)' };
  if (mode.includes('pet')) return { color: '#F8AC37', soft: '#fde9c8', glow: 'rgba(248,172,55,0.28)' };
  if (mode.includes('fce')) return { color: '#E62D2B', soft: '#fad6d5', glow: 'rgba(230,45,43,0.22)' };
  if (mode.includes('cae') || mode.includes('cpe')) {
    return { color: '#1E1E1C', soft: '#e5e5e2', glow: 'rgba(30,30,28,0.2)' };
  }
  if (mode.startsWith('toefl')) return { color: '#3660AB', soft: '#dde4f2', glow: 'rgba(54,96,171,0.22)' };
  return { color: '#469E7B', soft: '#dcebe3', glow: 'rgba(70,158,123,0.22)' };
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Ahora mismo';
  if (diffMins < 60) return `Hace ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  loading,
  collapsed = false,
  onToggleCollapsed,
}: SessionSidebarProps) {
  const handleToggle = () => onToggleCollapsed?.();
  const closeOnMobile = () => {
    if (isMobileViewport()) onToggleCollapsed?.();
  };
  const handleSelectSession = (id: string) => {
    onSelectSession(id);
    closeOnMobile();
  };
  const handleNewSession = () => {
    onNewSession();
    closeOnMobile();
  };

  return (
    <>
      {!collapsed && (
        <div
          aria-hidden
          onClick={handleToggle}
          className="md:hidden fixed inset-0 top-[60px] z-30 bg-black/30 backdrop-blur-sm"
        />
      )}
    <aside
      className={cn(
        'h-full flex flex-col overflow-hidden relative shrink-0',
        collapsed
          ? 'hidden md:flex md:w-16 transition-[width] duration-200 ease-out'
          : 'absolute inset-0 z-40 w-full md:relative md:inset-auto md:w-72 transition-[width] duration-200 ease-out'
      )}
      style={{
        background: '#fdfcf8',
      }}
    >
      <div
        aria-hidden
        className="absolute top-0 right-0 bottom-0 w-px bg-[#ece8de]"
      />

      <div className="relative z-10 flex items-center gap-2 px-3 py-3 shrink-0 min-h-[52px]">
        {!collapsed && (
          <div className="flex-1 flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-trebol-text/55">
              Sesiones
            </span>
            {sessions.length > 0 && (
              <span className="ml-auto text-[10px] font-semibold tabular-nums text-trebol-text/40">
                {sessions.length}
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={handleToggle}
          aria-label={collapsed ? 'Expandir' : 'Colapsar'}
          className="p-1.5 rounded-lg hover:bg-[#1E1E1C]/[0.05] transition-colors text-trebol-text/60 cursor-pointer"
        >
          {collapsed ? <ChevronRight size={16} strokeWidth={2} /> : <ChevronLeft size={16} strokeWidth={2} />}
        </button>
      </div>

      <div className="relative z-10 px-3 pb-3 shrink-0">
        <motion.button
          type="button"
          onClick={handleNewSession}
          aria-label="Nueva sesión"
          title="Nueva sesión"
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className={cn(
            'group w-full flex items-center gap-2 rounded-xl text-white font-bold text-sm transition-shadow hover:shadow-md cursor-pointer',
            collapsed ? 'justify-center p-2.5' : 'justify-start px-3.5 py-2.5'
          )}
          style={{
            background: '#3660AB',
            boxShadow: '0 2px 6px -2px rgba(54,96,171,0.35)',
          }}
        >
          <Plus size={16} strokeWidth={2.5} className="shrink-0" />
          {!collapsed && <span className="tracking-tight">Nueva sesión</span>}
        </motion.button>
      </div>

      <nav
        aria-label="Sesiones"
        className="relative z-10 flex-1 overflow-y-auto px-2 pb-3 space-y-1"
      >
        {loading && !collapsed && (
          <div className="text-xs font-bold text-trebol-text/40 px-3 py-3">Cargando…</div>
        )}
        {!loading && sessions.length === 0 && !collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="px-3 py-6 text-center"
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              className="relative w-14 h-14 mx-auto mb-3"
            >
              <Image
                src="/bob_avatar.png"
                alt="Bob"
                fill
                sizes="56px"
                className="object-contain drop-shadow-md"
              />
            </motion.div>
            <p className="text-[11px] font-black text-trebol-text/70 leading-snug">
              Aún no tienes sesiones
            </p>
            <p className="text-[10px] font-semibold text-trebol-text/40 mt-1 leading-relaxed">
              Empieza una práctica para crear tu primera.
            </p>
          </motion.div>
        )}
        {sessions.map((s) => {
          const Icon = (s.mode && MODE_ICON[s.mode]) || MessageSquare;
          const isActive = s.id === activeSessionId;
          const accent = modeAccent(s.mode);
          const completed = s.final_score != null;

          return (
            <div
              key={s.id}
              role="listitem"
              className={cn(
                'group relative w-full flex items-center gap-2.5 rounded-lg transition-colors cursor-pointer',
                collapsed ? 'justify-center p-2' : 'pl-3 pr-2 py-2',
                isActive ? '' : 'hover:bg-[#1E1E1C]/[0.035]'
              )}
              style={{
                background: isActive ? '#fff' : undefined,
                boxShadow: isActive
                  ? `inset 2px 0 0 0 ${accent.color}, 0 1px 2px rgba(0,0,0,0.04)`
                  : 'none',
              }}
              onClick={() => handleSelectSession(s.id)}
              title={s.title}
            >
              <div className="relative shrink-0">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{
                    background: isActive ? accent.soft : '#f4f1e8',
                    color: isActive ? accent.color : '#6b6b65',
                  }}
                >
                  <Icon size={14} strokeWidth={2} />
                </div>
                {completed && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2"
                    style={{ background: '#469E7B', borderColor: '#fdfcf8' }}
                  />
                )}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-[13px] truncate leading-tight',
                        isActive ? 'font-bold text-[#1E1E1C]' : 'font-semibold text-trebol-text/80'
                      )}
                    >
                      {s.title}
                    </div>
                    <div className="text-[10px] font-medium text-trebol-text/45 flex items-center gap-1.5 mt-0.5">
                      <span>{relativeDate(s.created_at)}</span>
                      {completed && (
                        <>
                          <span className="text-trebol-text/25">·</span>
                          <span className="font-bold tabular-nums" style={{ color: accent.color }}>
                            {s.final_score_max ? `${s.final_score}/${s.final_score_max}` : `${s.final_score}%`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(s.id);
                    }}
                    aria-label="Eliminar sesión"
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-trebol-text/30 hover:text-red-500 transition-all shrink-0"
                  >
                    <Trash2 size={12} strokeWidth={2.2} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
    </>
  );
}
