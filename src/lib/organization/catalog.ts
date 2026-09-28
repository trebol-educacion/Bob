import type { AvailableMode } from './types';
import type { CefrLevel, DynamicCard, ModeFramework } from '@/lib/types/practice';

export interface RawDynamicCardRow {
  framework: string;
  exam_part: string;
  cefr_level: string | null;
  label: string;
  description: string | null;
  status: string;
  skill: string;
}

export interface RawAvailableModeRow {
  framework: string;
  exam_part: string;
  cefr_level: string | null;
  label: string;
  description: string | null;
}

export function dedupeDynamicCards(rows: RawDynamicCardRow[]): DynamicCard[] {
  const seen = new Set<string>();
  const deduped: DynamicCard[] = [];
  for (const row of rows) {
    const key = `${row.framework}|${row.exam_part}|${row.cefr_level ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      const status = (row.status === 'coming_soon' || row.status === 'enabled')
        ? row.status
        : 'enabled';
      deduped.push({
        framework: row.framework,
        exam_part: row.exam_part,
        cefr_level: (row.cefr_level ?? null) as CefrLevel | null,
        label: row.label,
        description: row.description,
        mode_key: `${row.framework}_${row.exam_part}`,
        status,
        skill: row.skill,
      });
    }
  }
  return deduped;
}

export function dedupeAvailableModes(rows: RawAvailableModeRow[]): AvailableMode[] {
  const seen = new Set<string>();
  const deduped: AvailableMode[] = [];
  for (const row of rows) {
    const key = `${row.framework}|${row.exam_part}|${row.cefr_level ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push({
        framework: row.framework as ModeFramework,
        exam_part: row.exam_part,
        cefr_level: (row.cefr_level ?? null) as CefrLevel | null,
        label: row.label,
        description: row.description,
      });
    }
  }
  return deduped;
}
