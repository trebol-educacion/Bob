import type { Skill } from '@/lib/types/skills';

const MODE_SKILL_OVERRIDES: Record<string, Skill> = {
  cambridge_starters_part1: 'listening',
  toefl_listen_repeat: 'speaking',
};

/** Derives the skill bucket from a session mode string. Returns null for unrecognised modes. */
export function inferSkillFromMode(mode: string): Skill | null {
  const override = MODE_SKILL_OVERRIDES[mode];
  if (override) return override;
  if (mode.includes('listening') || mode.includes('assessment_listening')) return 'listening';
  if (mode.includes('reading')) return 'reading';
  if (mode.includes('writing')) return 'writing';
  if (
    mode.includes('speaking') ||
    mode.includes('_part2') ||
    mode.includes('_part3') ||
    mode.includes('_p2') ||
    mode.includes('_p3') ||
    mode.includes('_interview') ||
    mode.includes('assessment_speaking') ||
    mode === 'cambridge_ket_part2' ||
    mode === 'cambridge_ket_part3' ||
    mode === 'cambridge_fce_p2' ||
    mode === 'cambridge_pet_p2'
  ) return 'speaking';
  return null;
}

/** Derives framework, exam_part, and cefr_level from a mode string without a DB round-trip. */
export function inferModeMetadata(mode: string): {
  framework: string | null;
  exam_part: string | null;
  cefr_level: string | null;
} {
  if (mode.startsWith('cambridge_')) {
    const withoutPrefix = mode.replace(/^cambridge_/, '');
    const cefrMap: Record<string, string> = {
      starters: 'pre_a1',
      movers: 'a1',
      ket: 'a2',
      pet: 'b1',
      fce: 'b2',
    };
    const examMatch = withoutPrefix.match(/^(starters|movers|ket|pet|fce)/);
    const cefr_level = examMatch ? (cefrMap[examMatch[1]] ?? null) : null;
    const exam_part = withoutPrefix.replace(/^(starters|movers|ket|pet|fce)_?/, '') || null;
    return { framework: 'cambridge', exam_part: exam_part || null, cefr_level };
  }
  if (mode.startsWith('toefl_')) {
    const exam_part = mode.replace(/^toefl_/, '') || null;
    return { framework: 'toefl', exam_part: exam_part || null, cefr_level: 'b2' };
  }
  if (mode.startsWith('assessment_')) {
    return { framework: null, exam_part: mode, cefr_level: null };
  }
  return { framework: null, exam_part: null, cefr_level: null };
}
