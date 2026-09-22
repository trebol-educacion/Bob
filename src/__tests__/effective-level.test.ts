import { describe, it, expect } from 'vitest';
import { resolveEffectiveLevel } from '@/lib/levels/effective-level';
import type { SkillLevelMap } from '@/lib/types/skills';

function buildSkillLevels(partial: SkillLevelMap): SkillLevelMap {
  return partial;
}

describe('resolveEffectiveLevel', () => {
  it('usa skillLevels[skill] cuando existe', () => {
    const skillLevels = buildSkillLevels({
      speaking: { cefr_level: 'b1', origin: 'assessment', confidence: 0.9, last_assessment_at: null, updated_at: '2026-01-01' },
    });
    const result = resolveEffectiveLevel(skillLevels, 'a2', 'speaking');
    expect(result).toEqual({ level: 'b1', source: 'skill' });
  });

  it('usa el nivel del tenant cuando no hay nivel de destreza', () => {
    const result = resolveEffectiveLevel({}, 'a2', 'speaking');
    expect(result).toEqual({ level: 'a2', source: 'tenant' });
  });

  it('devuelve none cuando no hay nivel de destreza ni de tenant', () => {
    const result = resolveEffectiveLevel({}, null, 'speaking');
    expect(result).toEqual({ level: null, source: 'none' });
  });
});
