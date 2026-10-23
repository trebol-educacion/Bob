import type { createSupabaseServer } from '@/lib/supabase/server';
import type { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import type { ModeFramework } from '@/lib/types/practice';
import { extractOrgFrameworks, type OrgFrameworkQueryRow } from './frameworks';

export type OrgFrameworksSupabase =
  | Awaited<ReturnType<typeof createSupabaseServer>>
  | ReturnType<typeof createSupabaseBrowser>;

export interface FrameworkQueryError {
  table: string;
  schema: string;
  code: string | null;
  message: string;
}

export interface OrgFrameworksResult {
  frameworks: ModeFramework[];
  error: FrameworkQueryError | null;
}

/**
 * @param supabase
 * @param organizationId
 */
export async function loadOrganizationFrameworks(
  supabase: OrgFrameworksSupabase,
  organizationId: string | null,
): Promise<OrgFrameworksResult> {
  if (!organizationId) return { frameworks: [], error: null };

  const { data, error } = await supabase
    .schema('mia')
    .from('organization_frameworks')
    .select('framework_id, pedagogical_frameworks(name, type)')
    .eq('organization_id', organizationId);

  if (error) {
    return {
      frameworks: [],
      error: {
        table: 'organization_frameworks',
        schema: 'mia',
        code: error.code ?? null,
        message: error.message,
      },
    };
  }

  return { frameworks: extractOrgFrameworks((data ?? []) as OrgFrameworkQueryRow[]), error: null };
}

/**
 * @param caller
 * @param result
 */
export function logOrgFrameworksError(caller: string, result: OrgFrameworksResult): void {
  if (!result.error) return;
  const { table, schema, code, message } = result.error;
  console.error(
    `[${caller}] organization frameworks resolution failed: table=${table} schema=${schema} code=${code ?? 'unknown'} message=${message}`,
  );
}
