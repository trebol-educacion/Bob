import { describe, it, expect } from 'vitest';
import { isHintAvailable, markAssistedTurn, wasTurnAssisted } from '@/lib/practice/scaffolding';

describe('isHintAvailable', () => {
  it('no esta disponible antes de la segunda escucha', () => {
    expect(isHintAvailable(0)).toBe(false);
    expect(isHintAvailable(1)).toBe(false);
  });

  it('esta disponible a partir de la segunda escucha', () => {
    expect(isHintAvailable(2)).toBe(true);
    expect(isHintAvailable(3)).toBe(true);
  });
});

describe('markAssistedTurn / wasTurnAssisted', () => {
  it('normaliza valores parciales', () => {
    expect(markAssistedTurn({})).toEqual({ hintUsed: false, modelAnswerUsed: false });
    expect(markAssistedTurn({ hintUsed: true })).toEqual({ hintUsed: true, modelAnswerUsed: false });
  });

  it('marca asistido si hubo pista o respuesta modelo', () => {
    expect(wasTurnAssisted({ hintUsed: true, modelAnswerUsed: false })).toBe(true);
    expect(wasTurnAssisted({ hintUsed: false, modelAnswerUsed: true })).toBe(true);
    expect(wasTurnAssisted({ hintUsed: false, modelAnswerUsed: false })).toBe(false);
  });
});
