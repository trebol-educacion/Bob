'use client';

import React, { useState } from 'react';
import { MessageSquare, Image as ImageIcon, MessagesSquare, Users, BookOpen, Headphones, Mic, Plus, ChevronLeft, ChevronRight, Trash2, Hand, HelpCircle, User, GitCompare, MessageCircle, BookImage } from 'lucide-react';
import { BobSession, SessionMode } from '@/actions/sessions';
import { cn } from '@/lib/utils';

interface SessionSidebarProps {
  sessions: BobSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  loading?: boolean;
}

const MODE_ICON: Record<NonNullable<SessionMode>, React.ElementType> = {
  generic_situation: MessageSquare,
  generic_image: ImageIcon,
  generic_conversation: MessagesSquare,
  cambridge_starters_part1: Hand,
  cambridge_starters_part2: HelpCircle,
  cambridge_starters_part3: BookOpen,
  cambridge_starters_part4: User,
  cambridge_movers_part1: GitCompare,
  cambridge_movers_part2: MessageCircle,
  cambridge_movers_part3: BookImage,
  cambridge_movers_part4: User,
  cambridge_movers_part5: ImageIcon,
  cambridge_flyers_part1: BookOpen,
  cambridge_ket_part1: BookOpen,
  cambridge_ket_part2: BookOpen,
  cambridge_pet_p1: Users,
  cambridge_pet_p2: Users,
  cambridge_pet_p3: Users,
  cambridge_pet_p4: Users,
  cambridge_fce_p1: ImageIcon,
  cambridge_fce_p2: ImageIcon,
  cambridge_fce_p3: ImageIcon,
  cambridge_fce_p4: ImageIcon,
  cambridge_cae_p1: MessageSquare,
  cambridge_cae_p2: MessageSquare,
  cambridge_cae_p3: MessageSquare,
  cambridge_cae_p4: MessageSquare,
  cambridge_cpe_p1: MessageSquare,
  cambridge_cpe_p2: MessageSquare,
  cambridge_cpe_p3a: MessageSquare,
  cambridge_cpe_p3b: MessageSquare,
  cambridge_cpe_p4: MessageSquare,
  toefl_listen_repeat: Headphones,
  toefl_interview: Mic,
};

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
}: SessionSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      'shrink-0 h-full bg-white border-r-2 border-trebol-border flex flex-col transition-[width] duration-200 ease-out overflow-hidden',
      collapsed ? 'w-14' : 'w-72'
    )}>
      <div className="flex items-center gap-2 px-3 py-3 border-b border-trebol-border shrink-0 min-h-[52px]">
        {!collapsed && (
          <span className="flex-1 text-[11px] font-black uppercase tracking-widest text-trebol-text/60">
            Sesiones
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? 'Expandir' : 'Colapsar'}
          className="p-1.5 rounded-sm hover:bg-trebol-bg transition-colors text-trebol-text/70"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div className="px-2 py-2 shrink-0">
        <button
          type="button"
          onClick={onNewSession}
          aria-label="Nueva sesión"
          title="Nueva sesión"
          className={cn(
            'w-full flex items-center gap-2 rounded-sm bg-trebol-primary text-white font-bold text-sm transition-opacity hover:opacity-90',
            collapsed ? 'justify-center p-2' : 'justify-start px-3 py-2'
          )}
        >
          <Plus size={18} className="shrink-0" />
          {!collapsed && <span>Nueva sesión</span>}
        </button>
      </div>

      <nav aria-label="Sesiones" className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {loading && !collapsed && (
          <div className="text-xs text-trebol-text/50 px-2 py-3">Cargando…</div>
        )}
        {!loading && sessions.length === 0 && !collapsed && (
          <div className="text-xs text-trebol-text/50 px-2 py-6 text-center leading-relaxed">
            Aún no tienes sesiones.<br />Empieza una práctica para crear tu primera.
          </div>
        )}
        {sessions.map((s) => {
          const Icon = (s.mode && MODE_ICON[s.mode]) || MessageSquare;
          const isActive = s.id === activeSessionId;
          return (
            <div
              key={s.id}
              role="listitem"
              className={cn(
                'group w-full flex items-center gap-2 rounded-sm transition-colors cursor-pointer',
                collapsed ? 'justify-center p-2' : 'px-2 py-2',
                isActive
                  ? 'bg-trebol-primary/10 border border-trebol-primary'
                  : 'border border-transparent hover:bg-trebol-bg'
              )}
              onClick={() => onSelectSession(s.id)}
              title={s.title}
            >
              <div className="relative shrink-0">
                <Icon size={18} className={cn(isActive ? 'text-trebol-primary' : 'text-trebol-text/60')} />
                {s.final_score != null && (
                  <span
                    className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-white"
                    aria-label="Completed"
                  />
                )}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-trebol-text truncate">{s.title}</div>
                    <div className="text-[10px] text-trebol-text/50 flex items-center gap-1.5">
                      <span>{relativeDate(s.created_at)}</span>
                      {s.final_score != null && (
                        <>
                          <span className="text-trebol-text/30">·</span>
                          <span className="font-bold text-green-600">
                            {s.final_score_max ? `${s.final_score}/${s.final_score_max}` : `${s.final_score}%`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                    aria-label="Eliminar sesión"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-sm hover:bg-red-50 text-trebol-text/40 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
