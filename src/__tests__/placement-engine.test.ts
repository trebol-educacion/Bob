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
  it('sin resultados pide el primer grupo de a1', () => {
    const decision = nextPlacementStep({ outcomes: [] }, config);
    expect(decision).toEqual({ done: false, nextLevel: 'a1', groupIndex: 0 });
  });

  it('aprueba hasta el tope y termina en b2', () => {
    const decision = nextPlacementStep(
      {
        outcomes: [
          pass('a1'), pass('a1'),
          pass('a2'), pass('a2'),
          pass('b1'), pass('b1'),
          pass('b2'), pass('b2'),
        ],
      },
      config
    );
    expect(decision).toEqual({ done: true, resultLevel: 'b2' });
  });

  it('dos fallos en a1 paran la prueba con a1 como suelo, nunca null', () => {
    const decision = nextPlacementStep(
      { outcomes: [fail('a1'), fail('a1')] },
      config
    );
    expect(decision).toEqual({ done: true, resultLevel: 'a1' });
  });

  it('dos fallos en a2 paran la prueba con resultado a1', () => {
    const decision = nextPlacementStep(
      { outcomes: [pass('a1'), pass('a1'), fail('a2'), fail('a2')] },
      config
    );
    expect(decision).toEqual({ done: true, resultLevel: 'a1' });
  });

  it('el umbral del 60 % separa acierto de fallo', () => {
    const edge = (correct: number): PlacementGroupOutcome => ({ level: 'a1', correct, total: 10 });
    expect(nextPlacementStep({ outcomes: [edge(6), edge(6)] }, config)).toEqual({ done: false, nextLevel: 'a2', groupIndex: 0 });
    expect(nextPlacementStep({ outcomes: [edge(5), edge(5)] }, config)).toEqual({ done: true, resultLevel: 'a1' });
  });

  it('cualquier recorrido posible termina con un nivel y nunca con null', () => {
    const results = [true, false];
    const walk = (outcomes: PlacementGroupOutcome[]): void => {
      const decision = nextPlacementStep({ outcomes }, config);
      if (decision.done) {
        expect(PLACEMENT_LEVELS).toContain(decision.resultLevel);
        return;
      }
      for (const passed of results) {
        walk([...outcomes, passed ? pass(decision.nextLevel) : fail(decision.nextLevel)]);
      }
    };
    walk([]);
  });

  it('dos fallos en b1 paran la prueba con resultado a2', () => {
    const decision = nextPlacementStep(
      {
        outcomes: [pass('a1'), pass('a1'), pass('a2'), pass('a2'), fail('b1'), fail('b1')],
      },
      config
    );
    expect(decision).toEqual({ done: true, resultLevel: 'a2' });
  });

  it('dos fallos en b2 paran la prueba con resultado b1', () => {
    const decision = nextPlacementStep(
      {
        outcomes: [
          pass('a1'), pass('a1'),
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
      { outcomes: [fail('a1'), pass('a1')] },
      config
    );
    expect(decision).toEqual({ done: false, nextLevel: 'a2', groupIndex: 0 });
  });

  it('fallos en niveles distintos no se acumulan entre sí', () => {
    const decision = nextPlacementStep(
      { outcomes: [fail('a1'), pass('a1'), fail('a2'), pass('a2')] },
      config
    );
    expect(decision).toEqual({ done: false, nextLevel: 'b1', groupIndex: 0 });
  });
});
