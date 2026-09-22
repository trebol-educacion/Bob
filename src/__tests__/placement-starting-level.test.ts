import { describe, it, expect } from 'vitest';
import { resolveStartingLevel } from '@/lib/placement/starting-level';
import type { StageToLevelTable } from '@/lib/placement/starting-level';

const table: StageToLevelTable = {
  primaria: 'a2',
  eso: 'b1',
  bachillerato: 'b2',
};

describe('resolveStartingLevel', () => {
  it('etapa conocida devuelve su nivel de la tabla', () => {
    expect(resolveStartingLevel('eso', table)).toBe('b1');
  });

  it('etapa desconocida cae al respaldo por defecto (a2)', () => {
    expect(resolveStartingLevel('infantil', table)).toBe('a2');
  });

  it('sin etapa cae al respaldo por defecto (a2)', () => {
    expect(resolveStartingLevel(null, table)).toBe('a2');
  });

  it('respeta un respaldo explícito distinto de a2', () => {
    expect(resolveStartingLevel(null, table, 'b1')).toBe('b1');
  });
});
