'use client';

import React from 'react';
import Image from 'next/image';
import { ImageIcon } from 'lucide-react';

interface Props {
  caption: string;
  imageUrl?: string;
  label?: string;
}

/**
 * Picture slot for the challenge. Renders the pre-generated image when
 * `imageUrl` is set, otherwise a descriptive placeholder so no slot is empty.
 */
export function ChallengePicture({ caption, imageUrl, label }: Props) {
  if (imageUrl) {
    return (
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-trebol-border">
        <Image src={imageUrl} alt={caption} fill sizes="320px" className="object-cover" />
        {label && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/90 text-trebol-text text-xs font-black">
            {label}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="relative w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-trebol-border bg-trebol-bg/50 flex flex-col items-center justify-center gap-2 p-4 text-center">
      {label && (
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#3660AB]/10 text-[#3660AB] text-xs font-black">
          {label}
        </span>
      )}
      <ImageIcon size={28} strokeWidth={2} className="text-trebol-text/30" />
      <p className="text-[11px] font-bold text-trebol-text/55 leading-snug">{caption}</p>
    </div>
  );
}
