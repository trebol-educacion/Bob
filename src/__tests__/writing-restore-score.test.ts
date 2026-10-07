import { describe, expect, it } from 'vitest';
import type { StoredMessage } from '@/actions/messages';
import { restorePictureStory, restoreShortMessage } from '@/lib/ket/writing-restore';
import { toScore10 } from '@/lib/session/score';

const RUBRIC = { task_coverage: 1, grammar: 1, vocabulary: 1, fluency: 1 };

function message(role: StoredMessage['role'], msgType: StoredMessage['msg_type'], json: Record<string, unknown>): StoredMessage {
  return { id: crypto.randomUUID(), session_id: 's', user_id: 'u', role, msg_type: msgType, content_json: json, created_at: '2026-10-07' };
}

describe('KET writing restore keeps the rubric grade', () => {
  it('Short Message restores the same 0-10 grade the history shows', () => {
    const restored = restoreShortMessage([
      message('bob', 'evaluation', { is_final: true, understood: true, highlights: [], suggestions: [], rubric: RUBRIC }),
    ]);
    expect(toScore10(restored.feedback)).toBe(2.5);
  });

  it('Picture Story restores the same 0-10 grade the history shows', () => {
    const restored = restorePictureStory([
      message('bob', 'text', { kind: 'picture_story_prompt', scenes: [], image_urls: [] }),
      message('bob', 'evaluation', { is_final: true, understood: true, highlights: [], suggestions: [], rubric: RUBRIC }),
    ]);
    expect(toScore10(restored?.feedback)).toBe(2.5);
  });
});
