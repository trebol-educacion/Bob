import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prompts/db-prompts', () => ({
  getPrompt: vi.fn().mockResolvedValue('mock prompt'),
}));

vi.mock('@/lib/gemini-client', () => ({
  callGemini: vi.fn().mockResolvedValue({
    ok: true,
    data: { text: JSON.stringify({ framing: 'A shop.', message: 'Hi!' }) },
    latencyMs: 1,
  }),
}));

import { getPrompt } from '@/lib/prompts/db-prompts';
import { generateInitialChatAction } from '@/actions/gemini/conversation';

describe('generateInitialChatAction level (T7.5)', () => {
  it('passes the effective CEFR level to getPrompt instead of a hardcoded b1', async () => {
    await generateInitialChatAction('shopping', 'a2');

    expect(getPrompt).toHaveBeenCalledWith(
      'generic_conversation_shared_initial',
      expect.objectContaining({ CEFR_LEVEL: 'a2' })
    );
  });

  it('defaults to b1 when no level is provided', async () => {
    await generateInitialChatAction('shopping');

    expect(getPrompt).toHaveBeenCalledWith(
      'generic_conversation_shared_initial',
      expect.objectContaining({ CEFR_LEVEL: 'b1' })
    );
  });
});
