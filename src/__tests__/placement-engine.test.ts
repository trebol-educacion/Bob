import { describe, it, expect } from 'vitest';
import { nextPlacementStep } from '@/lib/placement/engine';
import { PLACEMENT_LEVELS } from '@/lib/placement/types';
import type { PlacementConfig, PlacementGroupOutcome } from '@/lib/placement/types';

const config: PlacementConfig = {
  levels: PLACEMENT_LEVELS,
  groupsPerLevel: 2,
  passThreshold: 0.6,
  failsToStop: 2,
};

function pass(level: PlacementGroupOutcome['level']): PlacementGroupOutcome {
  return { level, correct: 8, total: 10 };
}

function fail(level: PlacementGroupOutcome['level']): PlacementGroupOutcome {
  return { level, correct: 3, total: 10 };
}

describe('nextPlacementStep', () => {
  it('sin resultados pide el primer grupo de a2', () => {
    const decision = nextPlacementStep({ outcomes: [] }, config);
    expect(decision).toEqual({ done: false, nextLevel: 'a2', groupIndex: 0 });
  });

  it('aprueba hasta el tope y termina en b2', () => {
    const decision = nextPlacementStep(
      {
        outcomes: [
          pass('a2'), pass('a2'),
          pass('b1'), pass('b1'),
          pass('b2'), pass('b2'),
        ],
      },
      config
    );
    expect(decision).toEqual({ done: true, resultLevel: 'b2' });
  });

  it('dos fallos en a2 paran la prueba sin nivel superado', () => {
    const decision = nextPlacementStep(
      { outcomes: [fail('a2'), fail('a2')] },
      config
    );
    expect(decision).toEqual({ done: true, resultLevel: null });
  });

  it('dos fallos en b1 paran la prueba con resultado a2', () => {
    const decision = nextPlacementStep(
      {
        outcomes: [pass('a2'), pass('a2'), fail('b1'), fail('b1')],
      },
      config
    );
    expect(decision).toEqual({ done: true, resultLevel: 'a2' });
  });

  it('dos fallos en b2 paran la prueba con resultado b1', () => {
    const decision = nextPlacementStep(
      {
        outcomes: [
          pass('a2'), pass('a2'),
          pass('b1'), pass('b1'),
          fail('b2'), fail('b2'),
        ],
      },
      config
    );
    expect(decision).toEqual({ done: true, resultLevel: 'b1' });
  });

  it('un fallo suelto seguido de acierto no corta la prueba', () => {
    const decision = nextPlacementStep(
      { outcomes: [fail('a2'), pass('a2')] },
      config
    );
    expect(decision).toEqual({ done: false, nextLevel: 'b1', groupIndex: 0 });
  });

  it('fallos en niveles distintos no se acumulan entre sí', () => {
    const decision = nextPlacementStep(
      { outcomes: [fail('a2'), pass('a2'), fail('b1'), pass('b1')] },
      config
    );
    expect(decision).toEqual({ done: false, nextLevel: 'b2', groupIndex: 0 });
  });
});
