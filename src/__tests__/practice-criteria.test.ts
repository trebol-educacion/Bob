import { describe, it, expect } from 'vitest';
import { gradeFromTurnCriteria, readTurnCriteria, type PracticeTurnCriteria } from '@/lib/grading/practice-criteria';
import { gradePracticeSession } from '@/lib/grading/practice-rubric';
import { isCriteriaDetail } from '@/lib/practice/types';

function criteria(overrides: Partial<PracticeTurnCriteria> = {}): PracticeTurnCriteria {
  return { pronunciation: 4, fluency: 4, grammar: 4, vocabulary: 4, ...overrides };
}

describe('readTurnCriteria', () => {
  it('acepta las cuatro bandas y las limita a 0-5', () => {
    expect(readTurnCriteria({ pronunciation: 9, fluency: -2, grammar: 3, vocabulary: 2 })).toEqual({
      pronunciation: 5,
      fluency: 0,
      grammar: 3,
      vocabulary: 2,
    });
  });

  it('pronunciation ausente o nula queda en null sin invalidar el resto', () => {
    expect(readTurnCriteria({ pronunciation: null, fluency: 3, grammar: 3, vocabulary: 3 })?.pronunciation).toBeNull();
    expect(readTurnCriteria({ fluency: 3, grammar: 3, vocabulary: 3 })?.pronunciation).toBeNull();
  });

  it('rechaza formas incompletas o no numericas', () => {
    expect(readTurnCriteria(null)).toBeNull();
    expect(readTurnCriteria('x')).toBeNull();
    expect(readTurnCriteria({ fluency: 3, grammar: '3', vocabulary: 3 })).toBeNull();
    expect(readTurnCriteria({ fluency: 3, grammar: 3 })).toBeNull();
  });
});

describe('gradeFromTurnCriteria', () => {
  it('sin turnos con criterios devuelve null', () => {
    expect(gradeFromTurnCriteria([])).toBeNull();
    expect(gradeFromTurnCriteria([null, undefined])).toBeNull();
  });

  it('la nota es la media igual de las cuatro medias, calculada en codigo', () => {
    const grade = gradeFromTurnCriteria([
      criteria({ pronunciation: 5, fluency: 3, grammar: 4, vocabulary: 4 }),
      criteria({ pronunciation: 3, fluency: 3, grammar: 2, vocabulary: 4 }),
    ]);
    expect(grade?.detail).toEqual({ pronunciation: 8, fluency: 6, grammar: 6, vocabulary: 8 });
    expect(grade?.score).toBe(7);
  });

  it('sin turnos de audio la pronunciacion queda sin valorar y no penaliza la nota', () => {
    const grade = gradeFromTurnCriteria([criteria({ pronunciation: null, fluency: 5, grammar: 5, vocabulary: 5 })]);
    expect(grade?.detail.pronunciation).toBeNull();
    expect(grade?.score).toBe(10);
  });

  it('mezcla de turnos texto y audio promedia pronunciacion solo con los de audio', () => {
    const grade = gradeFromTurnCriteria([
      criteria({ pronunciation: null }),
      criteria({ pronunciation: 2 }),
    ]);
    expect(grade?.detail.pronunciation).toBe(4);
  });

  it('la nota nunca sale de rango y siempre trae feedback formativo', () => {
    const low = gradeFromTurnCriteria([criteria({ pronunciation: 0, fluency: 0, grammar: 0, vocabulary: 0 })]);
    const high = gradeFromTurnCriteria([criteria({ pronunciation: 5, fluency: 5, grammar: 5, vocabulary: 5 })]);
    expect(low?.score).toBe(0);
    expect(high?.score).toBe(10);
    expect(low?.feedback.length).toBeGreaterThan(0);
    expect(high?.feedback.length).toBeGreaterThan(0);
  });

  it('el feedback nombra el criterio mas fuerte y el mas debil', () => {
    const grade = gradeFromTurnCriteria([criteria({ pronunciation: 5, fluency: 3, grammar: 1, vocabulary: 3 })]);
    expect(grade?.feedback).toContain('pronunciation');
    expect(grade?.feedback).toContain('grammar');
  });

  it('el detalle de cuatro criterios se distingue del formato antiguo', () => {
    const grade = gradeFromTurnCriteria([criteria()]);
    expect(isCriteriaDetail(grade!.detail)).toBe(true);
    expect(isCriteriaDetail(gradePracticeSession([]).detail)).toBe(false);
  });
});
