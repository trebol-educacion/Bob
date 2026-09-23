import { describe, it, expect } from 'vitest';
import { gradePracticeSession, type PracticeTurnSignal } from '@/lib/grading/practice-rubric';

function turn(overrides: Partial<PracticeTurnSignal> = {}): PracticeTurnSignal {
  return { hasAudio: true, hintUsed: false, modelAnswerUsed: false, turnScore: 90, ...overrides };
}

describe('gradePracticeSession', () => {
  it('sin turnos, nota 0 y feedback neutro', () => {
    const result = gradePracticeSession([]);
    expect(result.score).toBe(0);
    expect(result.detail).toEqual({ participation: 0, fluency: 0, independence: 0, comprehension: 0 });
  });

  it('sin entrada audible nunca puntua alto', () => {
    const result = gradePracticeSession([
      turn({ hasAudio: false, turnScore: 100 }),
      turn({ hasAudio: false, turnScore: 100 }),
      turn({ hasAudio: false, turnScore: 100 }),
      turn({ hasAudio: false, turnScore: 100 }),
    ]);
    expect(result.score).toBeLessThanOrEqual(3);
  });

  it('con audio, buena fluidez y sin ayudas puntua alto', () => {
    const result = gradePracticeSession([
      turn(),
      turn(),
      turn(),
      turn(),
    ]);
    expect(result.score).toBeGreaterThan(7);
  });

  it('usar pista o respuesta modelo baja la independencia y la nota', () => {
    const assisted = gradePracticeSession([
      turn({ hintUsed: true }),
      turn({ modelAnswerUsed: true }),
      turn(),
      turn(),
    ]);
    const clean = gradePracticeSession([turn(), turn(), turn(), turn()]);
    expect(assisted.detail.independence).toBeLessThan(clean.detail.independence);
    expect(assisted.score).toBeLessThan(clean.score);
  });

  it('turnScore null no rompe el promedio de fluidez', () => {
    const result = gradePracticeSession([turn({ turnScore: null }), turn({ turnScore: 80 })]);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.detail.fluency).toBe(8);
  });
});
