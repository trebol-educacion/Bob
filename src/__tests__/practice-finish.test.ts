import { describe, it, expect, vi, beforeEach } from 'vitest';

const closePracticeSidecar = vi.fn();
const finishSession = vi.fn();

vi.mock('@/lib/session/lifecycle', () => ({
  currentUserId: vi.fn(async () => 'user-1'),
  finishSession: (...args: unknown[]) => finishSession(...args),
}));

vi.mock('@/lib/practice/sidecar', () => ({
  closePracticeSidecar: (...args: unknown[]) => closePracticeSidecar(...args),
}));

import { finishPracticeAction } from '@/actions/practice/finish';
import { restorePractice } from '@/lib/practice/messages';

const BASE = { hasAudio: true, hintUsed: false, modelAnswerUsed: false, turnScore: 80 };

describe('finishPracticeAction', () => {
  beforeEach(() => {
    closePracticeSidecar.mockReset().mockResolvedValue({ ok: true, data: null });
    finishSession.mockReset().mockResolvedValue({ ok: true, data: null });
  });

  it('con criterios por turno usa la rubrica de cuatro dimensiones', async () => {
    const result = await finishPracticeAction('s1', [
      { ...BASE, criteria: { pronunciation: 4, fluency: 4, grammar: 4, vocabulary: 4 } },
    ]);
    expect(result.detail).toEqual({ pronunciation: 8, fluency: 8, grammar: 8, vocabulary: 8 });
    expect(result.score).toBe(8);
    expect(closePracticeSidecar).toHaveBeenCalledWith(expect.objectContaining({ score: 8 }));
    expect(finishSession).toHaveBeenCalledWith(expect.objectContaining({ countsTowardProgress: false }));
  });

  it('sin criterios cae a la rubrica antigua y no se rompe', async () => {
    const result = await finishPracticeAction('s1', [BASE, BASE, BASE, BASE]);
    expect(Object.keys(result.detail).sort()).toEqual(['comprehension', 'fluency', 'independence', 'participation']);
    expect(result.persisted).toBe(true);
  });

  it('la evaluacion guardada se vuelve a abrir en el formato nuevo', async () => {
    await finishPracticeAction('s1', [
      { ...BASE, criteria: { pronunciation: null, fluency: 3, grammar: 3, vocabulary: 3 } },
    ]);
    const evaluation = finishSession.mock.calls[0][0].evaluation as Record<string, unknown>;
    const restored = restorePractice([{ role: 'bob', msg_type: 'evaluation', content_json: evaluation }]);
    expect(restored.result?.detail).toEqual({ pronunciation: null, fluency: 6, grammar: 6, vocabulary: 6 });
  });

  it('sin sesion devuelve la nota sin persistir nada', async () => {
    const result = await finishPracticeAction(null, []);
    expect(result.persisted).toBe(true);
    expect(closePracticeSidecar).not.toHaveBeenCalled();
  });
});
