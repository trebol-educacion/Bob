import type { ModeFramework } from '@/lib/types/practice';

const FRAMEWORK_NAME_MAP: Record<string, ModeFramework> = {
  'Cambridge English': 'cambridge',
  'TOEFL iBT': 'toefl',
};

export interface OrgFrameworkQueryRow {
  pedagogical_frameworks?: { name?: string; type?: string } | null;
}

export function normalizeFrameworkName(name: string): ModeFramework | null {
  return FRAMEWORK_NAME_MAP[name] ?? null;
}

export function extractOrgFrameworks(rows: OrgFrameworkQueryRow[]): ModeFramework[] {
  const result: ModeFramework[] = [];
  for (const row of rows) {
    if (row.pedagogical_frameworks?.type !== 'english') continue;
    const name = row.pedagogical_frameworks?.name;
    const normalized = name ? normalizeFrameworkName(name) : null;
    if (normalized && !result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return result;
}
