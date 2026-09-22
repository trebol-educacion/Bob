import { describe, it, expect } from 'vitest';
import { resolveLevelPolicy, isLevelSelectorTesterEnabled } from '@/lib/levels/level-policy';

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
