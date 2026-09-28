'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useOrganization } from '@/hooks/useOrganization';
import { getEcosystemLauncherConfigAction, type EcosystemLauncherConfig } from '@/actions/ecosystem';
import {
  getVisibleProducts,
  isLauncherPath,
  resolveLauncherItems,
  type LauncherItem,
} from '@/lib/ecosystem/launcher-config';
import { EcosystemLauncherBar } from './EcosystemLauncherBar';

const COLLAPSED_STORAGE_KEY = 'ecosystem-launcher-collapsed';

export function EcosystemFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userRole, accessGranted } = useOrganization();
  const [config, setConfig] = useState<EcosystemLauncherConfig | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    let next = true;
    try {
      next = localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(next);
  }, []);

  useEffect(() => {
    if (!accessGranted) return;
    getEcosystemLauncherConfigAction().then(setConfig);
  }, [accessGranted]);

  const items: LauncherItem[] = useMemo(() => {
    if (!accessGranted || !config) return [];
    return resolveLauncherItems(getVisibleProducts(userRole, pathname), config);
  }, [accessGranted, userRole, config, pathname]);

  if (!isLauncherPath(pathname) || items.length === 0) {
    return <>{children}</>;
  }

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="flex min-h-svh">
      <div className="min-w-0 flex-1">{children}</div>
      <EcosystemLauncherBar items={items} collapsed={collapsed} onToggle={toggle} />
    </div>
  );
}
