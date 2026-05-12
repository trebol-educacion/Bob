'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Organization, getOrganizationForUser } from '@/lib/organization';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';

interface OrganizationContextValue {
  organization: Organization | null;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextValue>({
  organization: null,
  loading: true,
});

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setLoading(false);
        return;
      }
      getOrganizationForUser(data.user.id)
        .then(setOrganization)
        .finally(() => setLoading(false));
    });
  }, []);

  return (
    <OrganizationContext.Provider value={{ organization, loading }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  return useContext(OrganizationContext);
}
