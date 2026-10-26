import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const pickSpy = vi.fn();
vi.mock('@/lib/practice/seed', () => ({
  pickPracticeSeed: (...args: unknown[]) => pickSpy(...args),
}));

const fetchSpy = vi.fn();
vi.mock('@/lib/practice/topics-repository', () => ({
  fetchPracticeTopics: (...args: unknown[]) => fetchSpy(...args),
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

  it('con topic elegido no sortea seed: usa la descripcion del topic y valida contra el nivel efectivo', async () => {
    fetchSpy.mockResolvedValue([
      { slug: 'food_health', areaSlug: 'personal_life', areaOrder: 1, sortOrder: 3, minCefrLevel: 'pre_a1', promptDescription: 'food, eating habits and health' },
    ]);
    const { preparePracticeAction } = await import('@/actions/practice/start');
    const result = await preparePracticeAction({
      mode: 'conversation',
      skillLevels: { speaking: { cefr_level: 'a2' } } as never,
      cefrActiveLevel: null,
      topicSlug: 'food_health',
    });

    expect(fetchSpy).toHaveBeenCalledWith('a2', 'food_health');
    expect(pickSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, data: { level: 'a2', seed: { topic: 'food, eating habits and health' } } });
  });

  it('un topic que el nivel no alcanza (la consulta no lo devuelve) falla con invalid_topic', async () => {
    fetchSpy.mockResolvedValue([]);
    const { preparePracticeAction } = await import('@/actions/practice/start');
    const result = await preparePracticeAction({
      mode: 'conversation',
      skillLevels: { speaking: { cefr_level: 'a2' } } as never,
      cefrActiveLevel: null,
      topicSlug: 'technology_innovation',
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_topic' });
    expect(pickSpy).not.toHaveBeenCalled();
  });

  it('un topic en un modo que no es conversation se rechaza sin consultar', async () => {
    const { preparePracticeAction } = await import('@/actions/practice/start');
    const result = await preparePracticeAction({ mode: 'picture', skillLevels: null, cefrActiveLevel: null, topicSlug: 'food_health' });

    expect(result).toMatchObject({ ok: false, code: 'invalid_topic' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('un fallo de lectura de topics es reintentable', async () => {
    fetchSpy.mockResolvedValue(null);
    const { preparePracticeAction } = await import('@/actions/practice/start');
    const result = await preparePracticeAction({ mode: 'conversation', skillLevels: null, cefrActiveLevel: null, topicSlug: 'food_health' });

    expect(result).toEqual({ ok: false, code: 'topics_unavailable', retryable: true });
  });

  it('sin topic elegido sigue sorteando como antes', async () => {
    const { preparePracticeAction } = await import('@/actions/practice/start');
    await preparePracticeAction({ mode: 'situation', skillLevels: null, cefrActiveLevel: null, topicSlug: null });

    expect(pickSpy).toHaveBeenCalledWith('situation');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
