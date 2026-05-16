'use client';

import Image from 'next/image';
import { motion } from 'motion/react';

const SIZE_MAP = {
  sm: { avatar: 64, text: 'text-sm' },
  md: { avatar: 96, text: 'text-base' },
  lg: { avatar: 128, text: 'text-lg' },
} as const;

/** Full-screen Bob mascot loader that covers residual wait states (D-B3). */
export function BobMascotLoader({
  message = 'Bob is thinking…',
  size = 'md',
}: {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { avatar, text } = SIZE_MAP[size];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Image
          src="/bob_avatar.png"
          alt="Bob"
          width={avatar}
          height={avatar}
          priority
          className="rounded-full drop-shadow-md"
        />
      </motion.div>
      <p className={`${text} text-trebol-text/60 font-semibold text-center`}>{message}</p>
    </div>
  );
}
