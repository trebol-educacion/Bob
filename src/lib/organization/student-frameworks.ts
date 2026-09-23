import type { createSupabaseServer } from '@/lib/supabase/server';
import type { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import type { ModeFramework } from '@/lib/types/practice';
import {
  resolveFrameworkNames,
  type PedagogicalFrameworkRow,
  type StudentFrameworkLinkRow,
} from './frameworks';

export type StudentFrameworksSupabase =
  | Awaited<ReturnType<typeof createSupabaseServer>>
  | ReturnType<typeof createSupabaseBrowser>;

export interface FrameworkQueryError {
  table: string;
  schema: string;
  code: string | null;
  message: string;
}

export interface StudentFrameworksResult {
  frameworks: ModeFramework[];
  error: FrameworkQueryError | null;
}

/**
 * @param supabase
 * @param userId
 */
export async function loadStudentFrameworks(
  supabase: StudentFrameworksSupabase,
  userId: string,
): Promise<StudentFrameworksResult> {
  const linksResult = await supabase
    .schema('public')
    .from('student_english_frameworks')
    .select('framework_id')
    .eq('user_id', userId);

  if (linksResult.error) {
    return {
      frameworks: [],
      error: {
        table: 'student_english_frameworks',
        schema: 'public',
        code: linksResult.error.code ?? null,
        message: linksResult.error.message,
      },
    };
  }

  const frameworkIds = ((linksResult.data ?? []) as StudentFrameworkLinkRow[]).map(
    (row) => row.framework_id,
  );
  if (frameworkIds.length === 0) {
    return { frameworks: [], error: null };
  }

  const frameworksResult = await supabase
    .schema('mia')
    .from('pedagogical_frameworks')
    .select('id, name, type')
    .in('id', frameworkIds);

  if (frameworksResult.error) {
    return {
      frameworks: [],
      error: {
        table: 'pedagogical_frameworks',
        schema: 'mia',
        code: frameworksResult.error.code ?? null,
        message: frameworksResult.error.message,
      },
    };
  }

  return {
    frameworks: resolveFrameworkNames(
      frameworkIds,
      (frameworksResult.data ?? []) as PedagogicalFrameworkRow[],
    ),
    error: null,
  };
}
