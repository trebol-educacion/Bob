'use client';

import React from 'react';
import { ActivityErrorState } from '@/components/activity/ActivityErrorState';

export interface ActivityLoadErrorProps {
  code?: string | null;
  message?: string | null;
  onBack: () => void;
  onRetry?: () => void;
}

/** @param props ActivityLoadErrorProps */
export function ActivityLoadError({ code, message, onBack, onRetry }: ActivityLoadErrorProps) {
  return <ActivityErrorState code={code} message={message} onBack={onBack} onRetry={onRetry} />;
}
