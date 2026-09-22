import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConversationErrorBannerProps {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}

export function ConversationErrorBanner({ message, retryLabel, onRetry }: ConversationErrorBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-red-500 shrink-0" />
        <p className="text-sm font-medium text-red-700">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="shrink-0 text-xs font-black text-red-700 uppercase tracking-wider hover:underline"
      >
        {retryLabel}
      </button>
    </div>
  );
}
