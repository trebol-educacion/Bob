import type { ModeFramework } from '@/lib/types/practice';

const FRAMEWORK_NAME_MAP: Record<string, ModeFramework> = {
  'Cambridge English': 'cambridge',
  'TOEFL iBT': 'toefl',
};

export interface PedagogicalFrameworkRow {
  id: string;
  name: string;
  type?: string | null;
}

export interface StudentFrameworkLinkRow {
  framework_id: string;
}

export interface OrgFrameworkQueryRow {
  pedagogical_frameworks?: { name?: string; type?: string } | null;
}

export function normalizeFrameworkName(name: string): ModeFramework | null {
  return FRAMEWORK_NAME_MAP[name] ?? null;
}

export function resolveFrameworkNames(
  frameworkIds: string[],
  frameworks: PedagogicalFrameworkRow[],
): ModeFramework[] {
  const byId = new Map(frameworks.map((framework) => [framework.id, framework]));
  const result: ModeFramework[] = [];
  for (const frameworkId of frameworkIds) {
    const framework = byId.get(frameworkId);
    const normalized = framework ? normalizeFrameworkName(framework.name) : null;
    if (normalized && !result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return result;
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
