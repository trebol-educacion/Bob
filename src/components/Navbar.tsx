'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, User } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/hooks/useOrganization';

interface NavbarProps {
  userEmail?: string;
}

export function Navbar({ userEmail }: NavbarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { organization } = useOrganization();

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
      <div className="flex items-center justify-between">
        {/* Logo */}
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

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/10 transition-colors"
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
                {/* Backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden z-50"
                >
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Cerrar sesión
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.header>
  );
}
