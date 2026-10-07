import { describe, it, expect } from 'vitest';
import { parsePlacementConfig, DEFAULT_PLACEMENT_CONFIG } from '@/lib/placement/config';

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
