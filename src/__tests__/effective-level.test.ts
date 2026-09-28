import { describe, it, expect } from 'vitest';
import { resolveEffectiveLevel } from '@/lib/levels/effective-level';
import { resolveLevelPolicy } from '@/lib/levels/level-policy';
import type { SkillLevelMap } from '@/lib/types/skills';
import type { PendingAssessmentsMap } from '@/actions/assessment/types';

function buildSkillLevels(partial: SkillLevelMap): SkillLevelMap {
  return partial;
}

const NO_PENDING: PendingAssessmentsMap = {
  speaking: null, listening: null, reading: null, writing: null,
};

describe('resolveEffectiveLevel', () => {
  it('usa skillLevels[skill] cuando existe', () => {
    const skillLevels = buildSkillLevels({
      speaking: { cefr_level: 'b1', origin: 'assessment', confidence: 0.9, last_assessment_at: null, updated_at: '2026-01-01' },
    });
    const result = resolveEffectiveLevel(skillLevels, 'a2', 'speaking');
    expect(result).toEqual({ level: 'b1', source: 'skill', placementPending: false, locked: false });
  });

  it('usa el nivel del tenant cuando no hay nivel de destreza', () => {
    const result = resolveEffectiveLevel({}, 'a2', 'speaking');
    expect(result).toEqual({ level: 'a2', source: 'tenant', placementPending: false, locked: false });
  });

  it('devuelve none cuando no hay nivel de destreza ni de tenant', () => {
    const result = resolveEffectiveLevel({}, null, 'speaking');
    expect(result).toEqual({ level: null, source: 'none', placementPending: false, locked: false });
  });

  it('marca placementPending cuando la destreza tiene una fila pendiente en la cola', () => {
    const pending: PendingAssessmentsMap = { ...NO_PENDING, speaking: { assessment_id: 'a-1', started_at: null } };
    const result = resolveEffectiveLevel({}, 'a2', 'speaking', pending);
    expect(result).toEqual({ level: 'a2', source: 'tenant', placementPending: true, locked: false });
  });

  it('no marca placementPending para otra destreza distinta a la pendiente', () => {
    const pending: PendingAssessmentsMap = { ...NO_PENDING, writing: { assessment_id: 'a-1', started_at: null } };
    const result = resolveEffectiveLevel({}, 'a2', 'speaking', pending);
    expect(result).toEqual({ level: 'a2', source: 'tenant', placementPending: false, locked: false });
  });

  it('marca locked cuando la política de nivel bloqueado salta el placement', () => {
    const policy = resolveLevelPolicy({ cefrLevelLocked: true, cefrActiveLevel: 'a2', testerOverrideEnabled: false });
    const result = resolveEffectiveLevel({}, 'a2', 'speaking', NO_PENDING, policy);
    expect(result).toEqual({ level: 'a2', source: 'tenant', placementPending: false, locked: true });
  });
});
