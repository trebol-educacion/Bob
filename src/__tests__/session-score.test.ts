import { describe, it, expect } from 'vitest';
import { toScore10, ratioToScore10, formatScore10 } from '@/lib/session/score';

describe('toScore10', () => {
  it('convierte score y score_max', () => {
    expect(toScore10({ score: 6, score_max: 8 })).toBe(7.5);
  });

  it('lee score_10 de la evaluación', () => {
    expect(toScore10({ score_10: 8.26 })).toBe(8.3);
  });

  it('lee score10 del examinador de speaking', () => {
    expect(toScore10({ kind: 'formative', score10: 6.5, score: 13, score_max: 20 })).toBe(6.5);
  });

  it('agrega la rúbrica de cuatro criterios', () => {
    expect(toScore10({ rubric: { task_coverage: 4, grammar: 3, vocabulary: 3, fluency: 2 } })).toBe(7.5);
  });

  it('devuelve null sin nota o con datos inválidos', () => {
    expect(toScore10({ feedback: 'x' })).toBeNull();
    expect(toScore10(null)).toBeNull();
    expect(toScore10({ score: 3, score_max: 0 })).toBeNull();
    expect(toScore10({ rubric: { task_coverage: 4 } })).toBeNull();
  });

  it('acota a 0-10', () => {
    expect(toScore10({ score_10: 12 })).toBe(10);
    expect(ratioToScore10(9, 8)).toBe(10);
  });
});

describe('formatScore10', () => {
  it('omite decimales en enteros y usa uno en el resto', () => {
    expect(formatScore10(7)).toBe('7/10');
    expect(formatScore10(7.5)).toBe('7.5/10');
  });
});
