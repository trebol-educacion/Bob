'use client';

import { useEffect } from 'react';
import { useOrganization } from '@/hooks/useOrganization';

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { organization } = useOrganization();

  useEffect(() => {
    if (!organization) return;
    const root = document.documentElement;
    if (organization.primary_color) {
      root.style.setProperty('--color-trebol-primary', organization.primary_color);
      root.style.setProperty('--color-bob-brand', organization.primary_color);
    }
    if (organization.secondary_color) {
      root.style.setProperty('--color-trebol-secondary', organization.secondary_color);
    }
    if (organization.accent_color) {
      root.style.setProperty('--color-trebol-accent', organization.accent_color);
    }
  }, [organization]);

  return <>{children}</>;
}
