import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const pickSpy = vi.fn();
vi.mock('@/lib/practice/seed', () => ({
  pickPracticeSeed: (...args: unknown[]) => pickSpy(...args),
}));

const SERVER_SEED = { angle: 'a', character: 'a friend', tone: 'warm', topic: 'server topic' };

describe('preparePracticeAction - seed unica elegida en el servidor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    pickSpy.mockReturnValue(SERVER_SEED);
  });

  it('elige la seed una sola vez y la devuelve junto al nivel efectivo, sin sesion ni LLM', async () => {
    const { preparePracticeAction } = await import('@/actions/practice/start');
    const result = await preparePracticeAction({
      mode: 'conversation',
      skillLevels: { speaking: { cefr_level: 'a2' } } as never,
      cefrActiveLevel: null,
    });

    expect(result).toEqual({ ok: true, data: { mode: 'conversation', level: 'a2', seed: SERVER_SEED } });
    expect(pickSpy).toHaveBeenCalledTimes(1);
    expect(pickSpy).toHaveBeenCalledWith('conversation');
  });

  it('un modo desconocido falla con codigo explicito', async () => {
    const { preparePracticeAction } = await import('@/actions/practice/start');
    const result = await preparePracticeAction({ mode: 'karaoke' as never, skillLevels: null, cefrActiveLevel: null });

    expect(result).toMatchObject({ ok: false, code: 'invalid_mode' });
    expect(pickSpy).not.toHaveBeenCalled();
  });

  it('el cliente ya no sortea ninguna seed', async () => {
    const { readFileSync } = await import('node:fs');
    const boot = readFileSync('src/hooks/practice/usePracticeBoot.ts', 'utf8');
    expect(boot).not.toContain('pickPracticeSeed');
  });
});
