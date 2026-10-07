import React from 'react';
import Image from 'next/image';
import { Loader2, ImageOff } from 'lucide-react';

export interface PracticeImagePanelProps {
  imageUrl: string | null;
  loading: boolean;
  loadingLabel: string;
  unavailableLabel: string;
}

export function PracticeImagePanel({ imageUrl, loading, loadingLabel, unavailableLabel }: PracticeImagePanelProps) {
  return (
    <div className="w-full max-w-xl mx-auto aspect-video rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
      {imageUrl ? (
        <Image src={imageUrl} alt="" width={800} height={450} className="w-full h-full object-cover" unoptimized />
      ) : loading ? (
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <Loader2 size={28} className="animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider">{loadingLabel}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-gray-300">
          <ImageOff size={28} />
          <span className="text-xs font-bold uppercase tracking-wider">{unavailableLabel}</span>
        </div>
      )}
    </div>
  );
}
