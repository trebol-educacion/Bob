'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { ECOSYSTEM_URL_KEYS, ECOSYSTEM_LOGO_KEYS } from '@/lib/ecosystem/launcher-config';

export type EcosystemLauncherConfig = Record<string, string | null>;

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: EcosystemLauncherConfig | null = null;
let cachedAt = 0;
let inflight: Promise<EcosystemLauncherConfig> | null = null;

async function fetchEcosystemLauncherConfig(): Promise<EcosystemLauncherConfig | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .schema('public')
    .from('platform_config')
    .select('key, value')
    .in('key', [...ECOSYSTEM_URL_KEYS, ...ECOSYSTEM_LOGO_KEYS]);

  if (error) {
    console.error('[ecosystem] platform_config query failed:', error);
    return null;
  }

  const config: EcosystemLauncherConfig = {};
  for (const row of (data ?? []) as { key: string; value: string | null }[]) {
    config[row.key] = row.value;
  }
  return config;
}

export async function getEcosystemLauncherConfigAction(): Promise<EcosystemLauncherConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;
  if (inflight) return inflight;

  inflight = fetchEcosystemLauncherConfig()
    .catch((error: unknown) => {
      console.error('[ecosystem] platform_config unavailable:', error);
      return null;
    })
    .then((config) => {
      if (!config) return {};
      cached = config;
      cachedAt = Date.now();
      return config;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
