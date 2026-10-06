import React from 'react';
import { ActivityErrorState } from '@/components/activity/ActivityErrorState';

export interface ConversationErrorBannerProps {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}

/** @param props ConversationErrorBannerProps */
export function ConversationErrorBanner({ message, retryLabel, onRetry }: ConversationErrorBannerProps) {
  return <ActivityErrorState variant="banner" message={message} retryLabel={retryLabel} onRetry={onRetry} />;
}
