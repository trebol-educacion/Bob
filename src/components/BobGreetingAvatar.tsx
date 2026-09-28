'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';

const SIZES = {
  md: { box: 'w-28 h-28 sm:w-36 sm:h-36', image: '144px' },
  lg: { box: 'w-32 h-32 sm:w-40 sm:h-40', image: '160px' },
} as const;

/** @param props.size md | lg */
export function BobGreetingAvatar({ size = 'lg' }: { size?: keyof typeof SIZES }) {
  const [videoEnded, setVideoEnded] = useState(false);
  const dims = SIZES[size];
  return (
    <div className={`relative ${dims.box} mx-auto mb-4 overflow-hidden rounded-full bg-white shadow-lg ring-4 ring-white`}>
      <motion.div
        animate={{ rotate: videoEnded ? [0, -6, 6, -4, 0] : 0 }}
        transition={{ delay: 0.2, duration: 1.4, ease: 'easeInOut' }}
        className="w-full h-full relative"
        style={{ transformOrigin: '50% 80%' }}
      >
        <Image
          src="/bob_avatar.png"
          alt="Bob"
          fill
          sizes={dims.image}
          className="object-cover object-[50%_0%] scale-95 origin-bottom"
        />
      </motion.div>
      {!videoEnded && (
        <video
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={() => setVideoEnded(true)}
          onError={() => setVideoEnded(true)}
          className="absolute inset-0 w-full h-full object-cover object-[50%_35%]"
        >
          <source src="/bob_hello.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}
