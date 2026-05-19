'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, User, BarChart3, Menu, Headphones, Mic2, BookOpen, PenLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/hooks/useOrganization';
import { NavProgressChip } from '@/components/NavProgressChip';
import type { Skill } from '@/lib/types/skills';

const SKILL_ICON: Record<Skill, React.ComponentType<{ className?: string }>> = {
  listening: Headphones,
  speaking: Mic2,
  reading: BookOpen,
  writing: PenLine,
};

const SKILL_LABEL: Record<Skill, string> = {
  listening: 'Listening',
  speaking: 'Speaking',
  reading: 'Reading',
  writing: 'Writing',
};

interface NavbarProps {
  userEmail?: string;
  onOpenDashboard?: () => void;
  onToggleSidebar?: () => void;
  onGoHome?: () => void;
}

export function Navbar({ userEmail, onOpenDashboard, onToggleSidebar, onGoHome }: NavbarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { organization, selectedSkill, skillLevels } = useOrganization();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const currentLevel = selectedSkill ? skillLevels?.[selectedSkill]?.cefr_level ?? null : null;
  const SkillIcon = selectedSkill ? SKILL_ICON[selectedSkill] : null;
  const t = useTranslations('shell.navbar');

  const handleLogout = async () => {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const displayName = userEmail?.split('@')[0] ?? '';

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full px-6 py-3 shadow-md bg-bob-brand"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label={t('openSessions')}
              className="md:hidden p-2 -ml-1 rounded-lg text-white/85 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Menu size={20} strokeWidth={2.4} />
            </button>
          )}
          <button
            type="button"
            onClick={onGoHome}
            disabled={!onGoHome}
            aria-label={t('goHome')}
            className="flex items-center rounded-lg p-1 -m-1 hover:bg-white/10 transition-colors disabled:cursor-default disabled:hover:bg-transparent cursor-pointer"
          >
            {organization?.logo_url ? (
              <img
                src={organization.logo_url}
                alt={organization.name}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <img
                src="/bob_logo.png"
                alt="BOB"
                className="h-8 w-auto object-contain"
              />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {mounted && selectedSkill && SkillIcon && (
            <div
              aria-label={`${SKILL_LABEL[selectedSkill]} level`}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5"
            >
              <SkillIcon className="w-4 h-4 text-white" />
              <span className="hidden sm:inline text-xs font-bold text-white/85">
                {SKILL_LABEL[selectedSkill]}
              </span>
              <span className="text-xs font-black uppercase tracking-wide text-white px-1.5 py-0.5 rounded-md bg-white/20">
                {currentLevel ?? '—'}
              </span>
            </div>
          )}
          {onOpenDashboard && <NavProgressChip onClick={onOpenDashboard} />}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <User size={18} className="text-white" />
            </div>
            <div className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-sm font-bold text-white capitalize">{displayName}</span>
              <span className="text-xs text-white/60 truncate max-w-[160px]">{userEmail}</span>
            </div>
          </button>

          <AnimatePresence>
            {open && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-52 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden z-50"
                >
                  {onOpenDashboard && (
                    <>
                      <button
                        onClick={() => {
                          setOpen(false);
                          onOpenDashboard();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-trebol-text hover:bg-trebol-secondary/20 transition-colors"
                      >
                        <BarChart3 size={16} className="text-trebol-primary" />
                        {t('myProgress')}
                      </button>
                      <div className="h-px bg-gray-100" />
                    </>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    {t('logOut')}
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        </div>
      </div>
    </motion.header>
  );
}
