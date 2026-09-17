import type { ModeFramework } from '@/lib/types/practice';

const FRAMEWORK_NAME_MAP: Record<string, ModeFramework> = {
  'Cambridge English': 'cambridge',
  'TOEFL iBT': 'toefl',
};

export interface FrameworkQueryRow {
  pedagogical_frameworks?: { name?: string; type?: string } | null;
}

export function normalizeFrameworkName(name: string): ModeFramework | null {
  return FRAMEWORK_NAME_MAP[name] ?? null;
}

export function extractStudentFrameworks(rows: FrameworkQueryRow[]): ModeFramework[] {
  return rows
    .map((r) => {
      const name = r.pedagogical_frameworks?.name;
      return name ? normalizeFrameworkName(name) : null;
    })
    .filter((f): f is ModeFramework => f !== null);
}

export function extractOrgFrameworks(rows: FrameworkQueryRow[]): ModeFramework[] {
  return rows
    .filter((r) => r.pedagogical_frameworks?.type === 'english')
    .map((r) => {
      const name = r.pedagogical_frameworks?.name;
      return name ? normalizeFrameworkName(name) : null;
    })
    .filter((f): f is ModeFramework => f !== null);
}
