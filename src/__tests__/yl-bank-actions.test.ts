import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const pickContent = vi.fn();
const callGemini = vi.fn(() => {
  throw new Error('Gemini must not be called when opening an activity');
});
const generateSpeech = vi.fn(() => {
  throw new Error('TTS must not be called when opening an activity');
});

vi.mock('@/lib/item-bank/content-source', () => ({ pickContent: (...a: unknown[]) => pickContent(...a) }));
vi.mock('@/lib/gemini-client', () => ({
  callGemini: (...a: unknown[]) => callGemini(...(a as [])),
  safeParseFallback: (_s: unknown, v: unknown) => v,
}));
vi.mock('@/actions/gemini', () => ({ generateSpeechAction: (...a: unknown[]) => generateSpeech(...(a as [])) }));
vi.mock('@/lib/session/lifecycle', () => ({ currentUserId: async () => 'user-1', ensureSession: vi.fn(), recordTurn: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: vi.fn() }));
vi.mock('@/actions/messages', () => ({ getMessagesAction: vi.fn() }));

import { startYLSessionAction } from '@/actions/modes/yl/session';
import { resolveCueAudioUrl, withBankAudio } from '@/lib/yl/bank-audio';

function groupOf(plan: unknown) {
  return { ok: true, data: { kind: 'group', group: { id: 'g1', metadata: { plan } }, items: [] } };
}

const POINTING = {
  cues: ['Point to the cat.', 'Point to the dog.', 'Point to the pen.', 'Point to the bed.'],
  options: ['cat', 'dog', 'pen', 'bed'],
  option_image_prompts: ['a', 'b', 'c', 'd'],
  image_prompts: ['a', 'b', 'c', 'd'],
  pointing_cues: [0, 1, 2, 3].map((i) => ({ target_index: i, text: `Point to the ${['cat', 'dog', 'pen', 'bed'][i]}.` })),
  image_urls: ['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg', 'https://x/4.jpg'],
  audio_urls: { 'Point to the cat.': 'https://x/a1.mp3' },
};

beforeEach(() => vi.clearAllMocks());

describe('YL activities open from the bank', () => {
  it('returns the banked plan with images and audio and never calls Gemini or TTS', async () => {
    pickContent.mockResolvedValue(groupOf(POINTING));
    const result = await startYLSessionAction({ mode: 'cambridge_starters_part1' });
    expect(result).toMatchObject({ ok: true, data: { plan: { bank_group_id: 'g1', image_urls: POINTING.image_urls } } });
    expect(pickContent).toHaveBeenCalledWith(
      expect.objectContaining({ framework: 'yle_starters', cefr: 'pre_a1', examPart: 'starters_part1', skill: 'speaking', groupsOnly: true, itemless: true }),
    );
    expect(callGemini).not.toHaveBeenCalled();
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it('uses the movers exam and level for movers modes', async () => {
    pickContent.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    await startYLSessionAction({ mode: 'cambridge_movers_part3' });
    expect(pickContent).toHaveBeenCalledWith(expect.objectContaining({ framework: 'yle_movers', cefr: 'a1', examPart: 'movers_part3' }));
  });

  it('returns no_content with an empty bank', async () => {
    pickContent.mockResolvedValue({ ok: false, code: 'no_content', retryable: false });
    expect(await startYLSessionAction({ mode: 'cambridge_starters_part2' })).toMatchObject({ ok: false, code: 'no_content' });
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('returns no_content when a stored plan lacks its images', async () => {
    pickContent.mockResolvedValue(groupOf({ ...POINTING, image_urls: [] }));
    expect(await startYLSessionAction({ mode: 'cambridge_starters_part1' })).toMatchObject({ ok: false, code: 'no_content' });
  });
});

describe('bank audio playback', () => {
  it('plays registered phrases from their URL and only falls back to live TTS for others', async () => {
    withBankAudio(POINTING as never);
    expect(await resolveCueAudioUrl('Point to the cat.')).toBe('https://x/a1.mp3');
    expect(generateSpeech).not.toHaveBeenCalled();
    await expect(resolveCueAudioUrl('Something new')).rejects.toThrow('TTS must not be called');
  });
});
