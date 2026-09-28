import { describe, it, expect } from 'vitest';
import { resolveLevelPolicy, isLevelSelectorTesterEnabled, mustTakePlacement, requiresPlacementGate } from '@/lib/levels/level-policy';
import type { SkillLevelMap } from '@/lib/types/skills';

describe('resolveLevelPolicy', () => {
  it('nivel bloqueado con nivel de tenant asignado → salta el placement', () => {
    const result = resolveLevelPolicy({
      cefrLevelLocked: true,
      cefrActiveLevel: 'b1',
      testerOverrideEnabled: false,
    });
    expect(result).toEqual({ skipPlacement: true, allowManualSelection: false });
  });

  it('nivel no bloqueado → no salta el placement', () => {
    const result = resolveLevelPolicy({
      cefrLevelLocked: false,
      cefrActiveLevel: 'b1',
      testerOverrideEnabled: false,
    });
    expect(result).toEqual({ skipPlacement: false, allowManualSelection: false });
  });

  it('bloqueado pero sin nivel de tenant asignado → no puede saltar el placement', () => {
    const result = resolveLevelPolicy({
      cefrLevelLocked: true,
      cefrActiveLevel: null,
      testerOverrideEnabled: false,
    });
    expect(result).toEqual({ skipPlacement: false, allowManualSelection: false });
  });

  it('tester → selección manual permitida aunque el nivel esté bloqueado', () => {
    const result = resolveLevelPolicy({
      cefrLevelLocked: true,
      cefrActiveLevel: 'b1',
      testerOverrideEnabled: true,
    });
    expect(result).toEqual({ skipPlacement: true, allowManualSelection: true });
  });
});

describe('isLevelSelectorTesterEnabled', () => {
  it('solo el literal "true" activa el flag', () => {
    expect(isLevelSelectorTesterEnabled('true')).toBe(true);
    expect(isLevelSelectorTesterEnabled('1')).toBe(false);
    expect(isLevelSelectorTesterEnabled(undefined)).toBe(false);
    expect(isLevelSelectorTesterEnabled('')).toBe(false);
  });
});

describe('mustTakePlacement', () => {
  it('destreza sin nivel asignado → exige placement', () => {
    expect(mustTakePlacement(null, 'listening')).toBe(true);
    expect(mustTakePlacement({}, 'listening')).toBe(true);
  });

  it('destreza con nivel asignado → no exige placement', () => {
    const skillLevels: SkillLevelMap = {
      listening: {
        cefr_level: 'b1',
        origin: 'assessment',
        confidence: null,
        last_assessment_at: null,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    };
    expect(mustTakePlacement(skillLevels, 'listening')).toBe(false);
  });

  it('solo exige placement para la destreza elegida, no para todas (Q5)', () => {
    const skillLevels: SkillLevelMap = {
      listening: {
        cefr_level: 'b1',
        origin: 'assessment',
        confidence: null,
        last_assessment_at: null,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    };
    expect(mustTakePlacement(skillLevels, 'listening')).toBe(false);
    expect(mustTakePlacement(skillLevels, 'reading')).toBe(true);
  });
});

describe('requiresPlacementGate', () => {
  it('modo cambridge a2/b1/b2 devuelve la destreza a exigir', () => {
    expect(requiresPlacementGate('cambridge_ket_listening_part1')).toBe('listening');
    expect(requiresPlacementGate('cambridge_pet_reading_comprehension')).toBe('reading');
    expect(requiresPlacementGate('cambridge_fce_reading_part1')).toBe('reading');
  });

  it('modo cambridge starters (pre_a1, YL) no se bloquea por este motor', () => {
    expect(requiresPlacementGate('cambridge_starters_p1')).toBeNull();
  });

  it('modo assessment/placement queda exento (no se autobloquea)', () => {
    expect(requiresPlacementGate('assessment_listening')).toBeNull();
    expect(requiresPlacementGate('placement_reading_a2')).toBeNull();
  });

  it('modo generico de practica libre no se bloquea', () => {
    expect(requiresPlacementGate('generic_conversation')).toBeNull();
  });

  it('modo toefl (b2) exige la destreza inferida', () => {
    expect(requiresPlacementGate('toefl_listen_repeat')).toBe('speaking');
  });
});
