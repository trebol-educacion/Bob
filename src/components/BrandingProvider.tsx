'use client';

import { useEffect } from 'react';
import { useOrganization } from '@/hooks/useOrganization';

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { organization } = useOrganization();

  useEffect(() => {
    if (!organization) return;
    const root = document.documentElement;
    const primary = organization.primary_color;
    const secondary = organization.secondary_color;
    const accent = organization.accent_color;
    if (primary) {
      root.style.setProperty('--color-trebol-primary', primary);
      root.style.setProperty('--color-bob-brand', primary);
    }
    if (secondary) {
      root.style.setProperty('--color-trebol-secondary', secondary);
    }
    if (accent) {
      root.style.setProperty('--color-trebol-accent', accent);
    }
    try {
      localStorage.setItem('bob-brand', JSON.stringify({ primary, secondary, accent }));
    } catch {
      // localStorage unavailable (private mode); skip silently
    }
  }, [organization]);

  return <>{children}</>;
}
