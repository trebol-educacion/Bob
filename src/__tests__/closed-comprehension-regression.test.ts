import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const completeMock = vi.fn();
const loadPlanMock = vi.fn();
vi.mock('@/lib/session/complete', () => ({ completeActivity: (...a: unknown[]) => completeMock(...a) }));
vi.mock('@/lib/item-bank/plan-bank', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/item-bank/plan-bank')>()),
  loadPlan: (...a: unknown[]) => loadPlanMock(...a),
}));

import { submitClosedSetAction } from '@/actions/modes/closed-set';
import { EXAM_PART_COMPONENT_MAP } from '@/lib/routing';
import { inferModeMetadata, inferSkillFromMode } from '@/lib/skill-from-mode';
import { toClosedItems } from '@/lib/toefl/choose-response-bank';
import { scoreClosedEntries, type ClosedEntry } from '@/lib/toefl/closed-set';
import type { ToeflChooseResponsePlan } from '@/lib/bank-plans/toefl-choose-response';
import { OFFICIAL_LISTENING_PARTS } from '@/lib/bank-plans/toefl-official-listening';
import { resolveListeningAudioUrl } from '@/components/practice/group-exercise/listening-audio-url';

const SUPABASE_URL = 'https://project.supabase.co';
const LETTERS = ['A', 'B', 'C', 'D'] as const;

function planWith(audioUrl: string): ToeflChooseResponsePlan {
  const item = (key: (typeof LETTERS)[number], index: number) => ({
    speaker: 'Woman' as const,
    utterance: `Utterance ${index}`,
    options: LETTERS.map((letter) => ({ key: letter, label: `Reply ${letter}` })),
    correct_key: key,
    explanation: 'Because.',
    audio_url: `${audioUrl}${index}.mp3`,
  });
  return { items: [item('A', 1), item('B', 2), item('C', 3), item('D', 4), item('A', 5), item('B', 6), item('C', 7), item('D', 8)] };
}

describe('T10.7 closed comprehension activity per framework and level', () => {
  const closedModes = Object.keys(EXAM_PART_COMPONENT_MAP).filter((mode) => {
    const skill = inferSkillFromMode(mode);
    return skill === 'reading' || skill === 'listening';
  });

  const levelsByFramework = new Map<string, Set<string | null>>();
  for (const mode of closedModes) {
    const { framework, cefr_level } = inferModeMetadata(mode);
    if (!framework) continue;
    levelsByFramework.set(framework, (levelsByFramework.get(framework) ?? new Set()).add(cefr_level));
  }

  it.each([
    ['cambridge', 'a2'],
    ['cambridge', 'b1'],
    ['cambridge', 'b2'],
  ])('%s %s has at least one routable reading or listening activity', (framework, level) => {
    expect(levelsByFramework.get(framework)?.has(level)).toBe(true);
  });

  it('toefl has a routable closed listening activity', () => {
    expect(levelsByFramework.get('toefl')?.size).toBeGreaterThan(0);
    expect(closedModes).toContain('toefl_listen_choose_response');
  });

  it.each(OFFICIAL_LISTENING_PARTS)('toefl %s routes as a closed listening activity', (part) => {
    expect(closedModes).toContain(part);
    expect(inferModeMetadata(part).framework).toBe('toefl');
  });

  it('every closed comprehension mode renders in the exam flow', () => {
    for (const mode of closedModes) {
      const route = EXAM_PART_COMPONENT_MAP[mode];
      expect(route.appState).toBe('exam-practicing');
      expect(typeof route.render).toBe('function');
    }
  });
});

describe('T8.5 closed comprehension flow: stimulus, answer, deterministic evaluation, history', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL);
    completeMock.mockReset().mockResolvedValue({ ok: true, data: { sessionId: 's1', score10: 5 } });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('serves relative bank audio from the public bucket and keeps absolute URLs untouched', () => {
    const relative = toClosedItems(planWith('/toefl/choose-response/official-m1-q'), 'g1');
    expect(relative[0].stimulus_audio_url).toBe(`${SUPABASE_URL}/storage/v1/object/public/bob-listening/toefl/choose-response/official-m1-q1.mp3`);
    const absolute = toClosedItems(planWith('https://cdn.example.com/q'), 'g2');
    expect(absolute[0].stimulus_audio_url).toBe('https://cdn.example.com/q1.mp3');
  });

  it('resolves official listening audio paths with the same bucket resolver', () => {
    expect(resolveListeningAudioUrl('/toefl/official/conversation/m1-q9-10.mp3')).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/bob-listening/toefl/official/conversation/m1-q9-10.mp3`,
    );
    expect(resolveListeningAudioUrl('https://cdn.example.com/talk.mp3')).toBe('https://cdn.example.com/talk.mp3');
  });

  it('grades by key without any model call and persists plan, answers and evaluation', async () => {
    const plan = planWith('/a/q');
    loadPlanMock.mockResolvedValue({ ok: true, data: plan });
    const items = toClosedItems(plan, 'g1');
    const selected = ['A', 'B', 'C', 'A', 'A', 'B', 'C', 'D'];
    const entries: ClosedEntry[] = items.map((item, index) => ({
      id: item.variant_id,
      selected: selected[index],
      expected: item.correct_key,
      explanation: item.explanation,
      match: 'key',
    }));
    expect(scoreClosedEntries(entries).filter((result) => result.correct)).toHaveLength(7);

    const outcome = await submitClosedSetAction({ mode: 'toefl_listen_choose_response', items, bankGroupId: 'g1', entries });
    expect(outcome).toMatchObject({ sessionId: 's1' });
    const saved = completeMock.mock.calls[0][0];
    expect(saved.evaluation).toMatchObject({ kind: 'closed_set_evaluation', score: 7, score_max: 8 });
    expect(saved.answers).toHaveLength(8);
    expect(saved.plan.items).toHaveLength(8);
    expect(saved.bank).toBeDefined();
  });

  it('keeps the grading path free of model clients', () => {
    for (const file of [
      'src/actions/modes/closed-set.ts',
      'src/lib/toefl/closed-set.ts',
      'src/actions/modes/toefl-official-listening.ts',
      'src/lib/toefl/official-listening-bank.ts',
    ]) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/gemini|genai/i);
    }
  });
});
