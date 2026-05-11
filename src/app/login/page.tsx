'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Mail, Lock, Loader2 } from 'lucide-react';
import ParticlesCanvas from '@/components/ParticlesCanvas';

const BG = '#3660AB';
const GREEN = '#F8AC37';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Por favor, completa todos los campos.');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    router.push('/');
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
        {/* Avatar + Logo */}
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

        {/* Card */}
        <div className="bg-white rounded-xl shadow-2xl">
          {/* CardHeader */}
          <div className="p-6 pb-0">
            <h2 className="text-2xl font-extrabold text-gray-900">Bienvenido</h2>
            <p className="text-sm text-gray-500 mt-1">
              Inicia sesión o crea una cuenta para continuar
            </p>
          </div>

          {/* CardContent */}
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-semibold text-gray-700 block">
                  Email o Usuario
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
                    placeholder="Ingresa tu correo o usuario"
                    autoComplete="email"
                    className="w-full h-10 pl-10 pr-3 rounded-md border border-gray-200 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    style={{ backgroundColor: '#E7EFFE' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-semibold text-gray-700">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    className="text-xs font-medium hover:underline"
                    style={{ color: BG }}
                  >
                    ¿Olvidaste tu contraseña?
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
                    Iniciando sesión...
                  </span>
                ) : (
                  'Iniciar sesión'
                )}
              </button>
            </form>
          </div>

          {/* CardFooter */}
          <div className="px-6 pb-6 flex flex-col space-y-4">
            <div className="text-center text-sm text-gray-500">
              <p>Próximamente:</p>
              <div className="flex justify-center space-x-4 mt-2">
                <span className="opacity-50 text-sm">Microsoft</span>
                <span className="opacity-50 text-sm">Google</span>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100 w-full flex justify-center space-x-4 text-xs font-medium text-gray-400">
              <button type="button" className="hover:text-gray-600 transition-colors">
                Centro de Confianza
              </button>
              <span className="text-gray-200">|</span>
              <button type="button" className="hover:text-gray-600 transition-colors">
                Protección del Estudiante
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
