'use client';

import { useEffect, useRef } from 'react';
import { trackUsageAction } from '@/actions/usage';
import { HEARTBEAT_INTERVAL_MS, INACTIVITY_LIMIT_MS, isActiveTick, clampSeconds } from '@/lib/usage/heartbeat';

const INTERACTION_EVENTS: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll'];

/**
 * @param mode string | null
 * @returns void
 */
export function useUsageHeartbeat(mode: string | null): void {
  const lastInteractionAtRef = useRef(0);
  const lastTickAtRef = useRef(0);

  useEffect(() => {
    if (!mode) return;

    lastInteractionAtRef.current = Date.now() - INACTIVITY_LIMIT_MS - 1;
    lastTickAtRef.current = Date.now();

    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
    };

    const flush = () => {
      const now = Date.now();
      const elapsedSeconds = Math.round((now - lastTickAtRef.current) / 1000);
      lastTickAtRef.current = now;
      if (elapsedSeconds <= 0) return;

      const active = isActiveTick({
        visible: document.visibilityState === 'visible',
        lastInteractionAt: lastInteractionAtRef.current,
        now,
      });
      if (!active) return;

      void trackUsageAction(mode, clampSeconds(elapsedSeconds)).catch(() => undefined);
    };

    for (const event of INTERACTION_EVENTS) {
      window.addEventListener(event, markInteraction, { passive: true });
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);

    const interval = window.setInterval(flush, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      for (const event of INTERACTION_EVENTS) {
        window.removeEventListener(event, markInteraction);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [mode]);
}
