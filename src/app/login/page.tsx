'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ParticlesCanvas from '@/components/ParticlesCanvas';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';

const BG = 'var(--color-bob-brand)';
const GREEN = '#F8AC37';

export default function LoginPage() {
  const t = useTranslations('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError(t('errorEmpty'));
      return;
    }
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError(t('errorCredentials'));
      setLoading(false);
      return;
    }
    window.location.assign('/');
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden"
      style={{ backgroundColor: BG }}
    >
      <ParticlesCanvas />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
        style={{ zIndex: 1 }}
      >
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div
              className="w-44 h-44 rounded-full overflow-hidden shadow-2xl flex items-end justify-center"
              style={{
                border: `5px solid ${GREEN}`,
                background: 'rgba(255,255,255,0.10)',
              }}
            >
              <img
                src="/bob_avatar.png"
                alt="Avatar BOB"
                className="w-[80%] object-contain"
              />
            </div>
          </div>
          <div className="flex items-center justify-center">
            <img
              src="/bob_logo.png"
              alt="BOB"
              className="h-20 w-auto object-contain"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-2xl">
          <div className="p-6 pb-0">
            <h2 className="text-2xl font-extrabold text-gray-900">{t('welcome')}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('subtitle')}
            </p>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-semibold text-gray-700 block">
                  {t('emailLabel')}
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <input
                    id="email"
                    name="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    autoComplete="email"
                    className="w-full h-10 pl-10 pr-3 rounded-md border border-gray-200 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    style={{ backgroundColor: '#E7EFFE' }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-semibold text-gray-700">
                    {t('passwordLabel')}
                  </label>
                  <button
                    type="button"
                    className="text-xs font-medium hover:underline"
                    style={{ color: BG }}
                  >
                    {t('forgotPassword')}
                  </button>
                </div>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full h-10 pl-10 pr-3 rounded-md border border-gray-200 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    style={{ backgroundColor: '#E7EFFE' }}
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: BG }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {t('submitLoading')}
                  </span>
                ) : (
                  t('submitIdle')
                )}
              </button>
            </form>
          </div>

          <div className="px-6 pb-6 flex flex-col space-y-4">
            <div className="text-center text-sm text-gray-500">
              <p>{t('comingSoon')}</p>
              <div className="flex justify-center space-x-4 mt-2">
                <span className="opacity-50 text-sm">Microsoft</span>
                <span className="opacity-50 text-sm">Google</span>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100 w-full flex justify-center space-x-4 text-xs font-medium text-gray-400">
              <button type="button" className="hover:text-gray-600 transition-colors">
                {t('trustCenter')}
              </button>
              <span className="text-gray-200">|</span>
              <button type="button" className="hover:text-gray-600 transition-colors">
                {t('studentProtection')}
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-center mt-6">
          <img
            src="/footer_login.png"
            alt="Footer"
            className="h-12 w-auto object-contain opacity-80"
          />
        </div>
      </motion.div>
    </div>
  );
}
