'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

const SIZE_MAP = {
  sm: { avatar: 64, text: 'text-sm', title: 'text-base' },
  md: { avatar: 96, text: 'text-sm', title: 'text-xl' },
  lg: { avatar: 128, text: 'text-base', title: 'text-2xl' },
} as const;

const TIPS = [
  'Practicar 10 minutos al día funciona mejor que una hora a la semana.',
  'Decir las palabras en voz alta ayuda a tu cerebro a recordarlas.',
  'Los errores son parte del aprendizaje. ¡No te preocupes por equivocarte!',
  'Repetir lo que escuchas mejora muchísimo tu pronunciación.',
  'Cuanto más juegas con el idioma, más rápido lo aprendes.',
  'Respira hondo antes de hablar. ¡Tú puedes!',
  'Escuchar canciones en inglés también es practicar.',
  'Bob está aquí para ayudarte. ¡Diviértete con la práctica!',
];

export function BobMascotLoader({
  message = 'Bob está pensando…',
  size = 'md',
}: {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { avatar, text, title } = SIZE_MAP[size];
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));

  useEffect(() => {
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 4200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden bg-[#fffbf2]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 22%, #fde9c8 0, transparent 36%), radial-gradient(circle at 82% 18%, #dde4f2 0, transparent 30%), radial-gradient(circle at 70% 84%, #dcebe3 0, transparent 34%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md w-full">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative"
          style={{ width: avatar + 24, height: avatar + 24 }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, #F8AC37, #469E7B, #3660AB, #E62D2B, #F8AC37)',
              filter: 'blur(14px)',
            }}
            animate={{ rotate: 360, opacity: [0.4, 0.55, 0.4] }}
            transition={{
              rotate: { duration: 6, repeat: Infinity, ease: 'linear' },
              opacity: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
            }}
          />
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-3 rounded-full bg-white shadow-xl ring-4 ring-white overflow-hidden"
          >
            <Image
              src="/bob_avatar.png"
              alt="Bob"
              width={avatar}
              height={avatar}
              priority
              className="w-full h-full object-cover"
            />
          </motion.div>
        </motion.div>

        <div className="text-center space-y-3 w-full">
          <h2 className={`${title} font-black text-trebol-text tracking-tight leading-tight`}>
            {message}
            <motion.span
              aria-hidden
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-block ml-1"
            >
              .
            </motion.span>
            <motion.span
              aria-hidden
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
              className="inline-block"
            >
              .
            </motion.span>
            <motion.span
              aria-hidden
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
              className="inline-block"
            >
              .
            </motion.span>
          </h2>

          <div className="relative h-2 w-full max-w-[280px] mx-auto rounded-full overflow-hidden bg-[#1E1E1C]/8">
            <motion.div
              className="absolute inset-y-0 w-1/3 rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, #3660AB 20%, #469E7B 50%, #F8AC37 80%, transparent)',
              }}
              animate={{ x: ['-100%', '300%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </div>

        <div className="min-h-[2.5rem] w-full max-w-sm flex items-start justify-center">
          <motion.p
            key={tipIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4 }}
            className={`${text} text-trebol-text/55 font-semibold text-center leading-relaxed`}
          >
            <span className="inline-block mr-1.5 text-[#F8AC37]">✨</span>
            {TIPS[tipIndex]}
          </motion.p>
        </div>
      </div>
    </div>
  );
}
