import { describe, it, expect } from 'vitest';
import { parsePlacementConfig, parsePlacementCooldownDays, DEFAULT_PLACEMENT_CONFIG, DEFAULT_PLACEMENT_COOLDOWN_DAYS } from '@/lib/placement/config';

describe('parsePlacementConfig', () => {
  it('sin fila en test_configs devuelve el respaldo por defecto', () => {
    expect(parsePlacementConfig(null)).toEqual(DEFAULT_PLACEMENT_CONFIG);
  });

  it('fila valida se respeta tal cual', () => {
    const raw = { levels: ['a2', 'b1'], groupsPerLevel: 3, passThreshold: 0.5, failsToStop: 1 };
    expect(parsePlacementConfig(raw)).toEqual(raw);
  });

  it('campos invalidos o ausentes caen al respaldo por defecto campo a campo', () => {
    const raw = { levels: 'a2', groupsPerLevel: '3' };
    expect(parsePlacementConfig(raw)).toEqual(DEFAULT_PLACEMENT_CONFIG);
  });
});

describe('parsePlacementCooldownDays', () => {
  it('sin config devuelve el respaldo por defecto (7 dias)', () => {
    expect(parsePlacementCooldownDays(null)).toBe(DEFAULT_PLACEMENT_COOLDOWN_DAYS);
  });

  it('config con cooldownDays numerico se respeta', () => {
    expect(parsePlacementCooldownDays({ cooldownDays: 14 })).toBe(14);
  });
});
