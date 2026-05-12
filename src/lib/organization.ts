import { createSupabaseBrowser } from '@/lib/supabase/browser-client';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  is_bob_enabled: boolean;
  is_mia_enabled: boolean;
}

export async function getOrganizationForUser(userId: string): Promise<Organization | null> {
  const supabase = createSupabaseBrowser();

  // 1. Buscar profile del usuario (profiles.id = auth.users.id)
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (!profile?.organization_id) return null;

  // 2. Cargar organización
  const { data: org } = await supabase
    .from('organizations')
    .select(
      'id, name, slug, logo_url, primary_color, secondary_color, accent_color, background_color, text_color, is_bob_enabled, is_mia_enabled'
    )
    .eq('id', profile.organization_id)
    .single();

  return org ?? null;
}
