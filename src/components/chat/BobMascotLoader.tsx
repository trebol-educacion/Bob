'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

const SIZE_MAP = {
  sm: { avatar: 64, text: 'text-sm', title: 'text-base' },
  md: { avatar: 96, text: 'text-sm', title: 'text-xl' },
  lg: { avatar: 128, text: 'text-base', title: 'text-2xl' },
} as const;

export function BobMascotLoader({
  message,
  size = 'md',
}: {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const t = useTranslations('chat');
  const tips = t.raw('mascotLoader.tips') as string[];
  const resolvedMessage = message ?? t('mascotLoader.defaultMessage');
  const { avatar, text, title } = SIZE_MAP[size];
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * tips.length));

  useEffect(() => {
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, 4200);
    return () => clearInterval(id);
  }, [tips.length]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden bg-white">
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
              background: 'var(--color-bob-brand)',
              filter: 'blur(14px)',
            }}
            animate={{ opacity: [0.25, 0.4, 0.25] }}
            transition={{
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
              className="w-full h-full object-cover object-[50%_0%] scale-95 origin-bottom"
            />
          </motion.div>
        </motion.div>

        <div className="text-center space-y-3 w-full">
          <h2 className={`${title} font-black text-trebol-text tracking-tight leading-tight`}>
            {resolvedMessage}
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
                  'linear-gradient(90deg, transparent, var(--color-bob-brand) 50%, transparent)',
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
            <span className="inline-block mr-1.5 text-bob-brand">✨</span>
            {tips[tipIndex]}
          </motion.p>
        </div>
      </div>
    </div>
  );
}
