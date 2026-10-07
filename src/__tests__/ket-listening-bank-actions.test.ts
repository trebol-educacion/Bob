import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const pickContent = vi.fn();
const callGemini = vi.fn(() => {
  throw new Error('Gemini must not be called when opening an activity');
});
const generateSpeech = vi.fn(() => {
  throw new Error('TTS must not be called when opening an activity');
});
const generateImages = vi.fn(() => {
  throw new Error('Images must not be generated when opening an activity');
});

vi.mock('@/lib/item-bank/content-source', () => ({ pickContent: (...a: unknown[]) => pickContent(...a) }));
vi.mock('@/lib/gemini-client', () => ({ callGemini: (...a: unknown[]) => callGemini(...(a as [])), isOk: () => false }));
vi.mock('@/actions/gemini', () => ({ generateSpeechAction: (...a: unknown[]) => generateSpeech(...(a as [])) }));
vi.mock('@/actions/modes/yl', () => ({ generateYLImagesParallelAction: (...a: unknown[]) => generateImages(...(a as [])) }));
vi.mock('@/lib/session/lifecycle', () => ({ currentUserId: async () => 'user-1' }));
vi.mock('@/lib/session/complete', () => ({ completeActivity: vi.fn() }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: vi.fn(async () => 'framing') }));

import { generateKETListenAndChooseAction } from '@/actions/modes/ket-listening-part1';
import { generateKETListenCompleteAction } from '@/actions/modes/ket-listening-part2';
import { generateKETListenDecideAction } from '@/actions/modes/ket-listening-part3';
import { startKETShortConversationsAction } from '@/actions/modes/ket-listening-part4';
import { startKETListenMatchAction } from '@/actions/modes/ket-listening-part5';

const URL = 'https://cdn/audio.mp3';
const turns = [
  { speaker: 'M', line: 'hello' },
  { speaker: 'W', line: 'hi' },
  { speaker: 'M', line: 'ok' },
  { speaker: 'W', line: 'bye' },
];
const abc = { A: 'a', B: 'b', C: 'c' };
const numbers = [1, 2, 3, 4, 5];

const CHOOSE = {
  items: numbers.map((n) => ({
    number: n,
    context: 'c',
    dialogue: turns.slice(0, 2),
    question: 'q',
    options: (['A', 'B', 'C'] as const).map((id) => ({ id, description: 'd', image_prompt: 'p', image_url: 'https://cdn/i.jpg' })),
    correct_option: 'A',
    audio_url: URL,
  })),
};
const COMPLETE = {
  context: 'c',
  form_title: 't',
  transcript: 'x',
  gaps: numbers.map((n) => ({ number: n, label: 'l', answer: 'a' })),
  audio_url: URL,
};
const DECIDE = {
  context: 'c',
  conversation: turns,
  items: numbers.map((n) => ({ number: n, question: 'q', options: abc, answer: 'A' })),
  audio_url: URL,
};
const KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SHORT = {
  items: numbers.map((n) => ({ number: n, context: `c${n}`, dialogue: turns, question: 'q', options: abc, answer: 'A', audio_url: URL })),
};
const MATCH = {
  instruction: 'What present does each person get?',
  conversation: [...turns, ...turns],
  people: numbers.map((n) => ({ number: n, name: `n${n}`, answer: KEYS[n - 1] })),
  options: KEYS.map((key) => ({ key, text: 't' })),
  audio_url: URL,
};

const CASES = [
  { part: 'ket_listening_part1', plan: CHOOSE, open: () => generateKETListenAndChooseAction() },
  { part: 'ket_listening_part2', plan: COMPLETE, open: () => generateKETListenCompleteAction() },
  { part: 'ket_listening_part3', plan: DECIDE, open: () => generateKETListenDecideAction() },
  { part: 'ket_listening_part4', plan: SHORT, open: () => startKETShortConversationsAction() },
  { part: 'ket_listening_part5', plan: MATCH, open: () => startKETListenMatchAction() },
];

function groupOf(plan: unknown) {
  return { ok: true, data: { kind: 'group', group: { id: 'g1', metadata: { plan } }, items: [] } };
}

beforeEach(() => vi.clearAllMocks());

describe.each(CASES)('$part opens from the bank', ({ part, plan, open }) => {
  it('reads the banked plan and never calls Gemini, TTS or image generation', async () => {
    pickContent.mockResolvedValue(groupOf(plan));
    const result = await open();
    expect(result).toMatchObject({ ok: true });
    expect(JSON.stringify(result)).toContain(URL);
    expect(JSON.stringify(result)).toContain('g1');
    expect(pickContent).toHaveBeenCalledWith(
      expect.objectContaining({ framework: 'ket', cefr: 'a2', examPart: part, skill: 'listening', groupsOnly: true, itemless: true }),
    );
    expect(callGemini).not.toHaveBeenCalled();
    expect(generateSpeech).not.toHaveBeenCalled();
    expect(generateImages).not.toHaveBeenCalled();
  });

  it('returns no_content with an empty bank', async () => {
    pickContent.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    expect(await open()).toMatchObject({ ok: false, code: 'no_content' });
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('returns no_content when the stored plan lacks its audio', async () => {
    const { audio_url: _audio, ...withoutAudioUrl } = plan as Record<string, unknown>;
    const stripped = part === 'ket_listening_part4'
      ? { items: SHORT.items.map(({ audio_url: _a, ...i }) => i) }
      : part === 'ket_listening_part1'
        ? { items: CHOOSE.items.map(({ audio_url: _a, ...i }) => i) }
        : withoutAudioUrl;
    pickContent.mockResolvedValue(groupOf(stripped));
    expect(await open()).toMatchObject({ ok: false, code: 'no_content' });
  });
});
