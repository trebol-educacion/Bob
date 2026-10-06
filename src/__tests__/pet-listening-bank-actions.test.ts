import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const pickContent = vi.fn();
const callGemini = vi.fn(() => {
  throw new Error('Gemini must not be called when opening an activity');
});
const speech = vi.fn(() => {
  throw new Error('TTS must not be called when opening an activity');
});

vi.mock('@/lib/item-bank/content-source', () => ({ pickContent: (...a: unknown[]) => pickContent(...a) }));
vi.mock('@/lib/gemini-client', () => ({ callGemini: (...a: unknown[]) => callGemini(...(a as [])), isOk: () => false }));
vi.mock('@/actions/gemini', () => ({ generateSpeechAction: (...a: unknown[]) => speech(...(a as [])) }));
vi.mock('@/lib/session/lifecycle', () => ({
  currentUserId: async () => 'u1',
  openSession: vi.fn(),
  recordTurn: vi.fn(),
  finishSession: vi.fn(),
}));
vi.mock('@/lib/session/complete', () => ({ completeActivity: vi.fn() }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn(async () => 'framing') }));
vi.mock('@/lib/persist-activity', () => ({ readSessionMessages: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }));

import { generatePETListeningSituationalAction } from '@/actions/modes/pet-listening-part1';
import { startPETListeningPart2Action } from '@/actions/modes/pet-listening-part2';
import { generatePETListeningGapFillAction } from '@/actions/modes/pet-listening-part3';
import { generatePETListeningAttitudeAction } from '@/actions/modes/pet-listening-part4';
import { generatePETListeningTrueFalseJustifyAction } from '@/actions/modes/pet-listening-part5';
import { PetAttitudePlanSchema } from '@/lib/bank-plans/pet-listening-part4';
import { PetSituationalDraftSchema, PetSituationalPlanSchema } from '@/lib/bank-plans/pet-listening-part1';

const six = <T>(make: (n: number) => T) => Array.from({ length: 6 }, (_, i) => make(i + 1));
const options = { A: 'a', B: 'b', C: 'c' };

const PLANS = {
  pet_listening_part1: {
    context: 'c',
    items: six((number) => ({
      number,
      conversation: [{ speaker: 'M', line: 'hi' }, { speaker: 'W', line: 'yo' }],
      question: 'q',
      options,
      answer: 'A',
      audio_url: 'https://cdn/1.mp3',
    })),
  },
  pet_listening_part3: {
    context: 'c',
    summary_title: 't',
    transcript: 'x',
    summary: 's',
    gaps: six((number) => ({ number, answer: 'a', accept: [] })),
    word_bank: ['a', 'b', 'c', 'd', 'e', 'f'],
    audio_url: 'https://cdn/3.mp3',
  },
  pet_listening_part4: {
    context: 'c',
    items: six((number) => ({ number, monologue: 'm', question: 'q', options, answer: 'B', audio_url: 'https://cdn/4.mp3' })),
  },
  pet_listening_part5: {
    context: 'c',
    audio: [{ speaker: 'M', line: 'a' }, { speaker: 'W', line: 'b' }],
    audio_url: 'https://cdn/5.mp3',
    statements: six((number) => ({ number, text: 't', is_true: true })),
  },
} as const;

const OPEN = [
  ['pet_listening_part1', () => generatePETListeningSituationalAction()],
  ['pet_listening_part3', () => generatePETListeningGapFillAction()],
  ['pet_listening_part4', () => generatePETListeningAttitudeAction()],
  ['pet_listening_part5', () => generatePETListeningTrueFalseJustifyAction()],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(OPEN)('%s opens from the bank', (part, open) => {
  it('serves the banked plan with its audio url and never calls Gemini or TTS', async () => {
    pickContent.mockResolvedValue({ ok: true, data: { kind: 'group', group: { id: 'g1', metadata: { plan: PLANS[part] } }, items: [] } });
    const result = await open();
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).toContain('https://cdn/');
    expect(pickContent).toHaveBeenCalledWith(
      expect.objectContaining({ framework: 'pet', cefr: 'b1', examPart: part, groupsOnly: true, itemless: true, skill: 'listening' }),
    );
    expect(callGemini).not.toHaveBeenCalled();
    expect(speech).not.toHaveBeenCalled();
  });

  it('returns no_content with an empty bank', async () => {
    pickContent.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    expect(await open()).toMatchObject({ ok: false, code: 'no_content' });
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('returns no_content when the stored plan breaks the contract', async () => {
    pickContent.mockResolvedValue({ ok: true, data: { kind: 'group', group: { id: 'g1', metadata: { plan: { context: 'x' } } }, items: [] } });
    expect(await open()).toMatchObject({ ok: false, code: 'no_content' });
  });
});

describe('pet_listening_part2 opens from the curated bank', () => {
  it('returns no_content as an action result with an empty bank', async () => {
    pickContent.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    expect(await startPETListeningPart2Action()).toMatchObject({ ok: false, code: 'no_content' });
    expect(callGemini).not.toHaveBeenCalled();
    expect(speech).not.toHaveBeenCalled();
  });
});

describe('plan contracts', () => {
  it('a draft without audio is not servable but the audio plan is', () => {
    const draft = { ...PLANS.pet_listening_part1, items: PLANS.pet_listening_part1.items.map(({ audio_url: _url, ...rest }) => rest) };
    expect(PetSituationalDraftSchema.safeParse(draft).success).toBe(true);
    expect(PetSituationalPlanSchema.safeParse(draft).success).toBe(false);
    expect(PetSituationalPlanSchema.safeParse(PLANS.pet_listening_part1).success).toBe(true);
    expect(PetAttitudePlanSchema.safeParse(PLANS.pet_listening_part4).success).toBe(true);
  });
});
