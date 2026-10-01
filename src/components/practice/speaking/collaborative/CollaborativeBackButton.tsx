'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';

export function CollaborativeBackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
    >
      <ArrowLeft size={18} />
    </button>
  );
}
