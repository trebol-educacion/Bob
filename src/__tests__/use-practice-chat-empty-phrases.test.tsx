// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePracticeChat } from '@/hooks/usePracticeChat';

vi.mock('@/actions/gemini', () => ({
  generateTopicPhrasesAction: vi.fn(),
  generateImageSceneAction: vi.fn(),
  generateImageAction: vi.fn(),
  evaluatePronunciationAction: vi.fn(),
  evaluateImageDescriptionAction: vi.fn(),
}));

vi.mock('@/actions/modes/yl', () => ({
  pregenerateYLCueAudiosAction: vi.fn(),
}));

import { generateTopicPhrasesAction } from '@/actions/gemini';

describe('usePracticeChat · lista de frases vacía', () => {
  beforeEach(() => {
    vi.mocked(generateTopicPhrasesAction).mockReset();
  });

  it('no avanza a phrase-ready y vuelve a topic-input si generated.length === 0', async () => {
    vi.mocked(generateTopicPhrasesAction).mockResolvedValue([]);

    const { result } = renderHook(() =>
      usePracticeChat({
        mode: 'situation',
        onBack: () => {},
        onSessionStart: async () => 'session-1',
      })
    );

    act(() => {
      result.current.setInputText('a topic');
    });

    await act(async () => {
      await result.current.handleTopicSubmit();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('topic-input');
    });
    expect(result.current.dynamicPhrases).toEqual([]);
  });
});
