import { describe, it, expect } from 'vitest';
import { mapStoredMessagesToConversation } from '@/lib/conversation/restore';
import type { StoredMessage } from '@/actions/messages';

function stored(overrides: Partial<StoredMessage>): StoredMessage {
  return {
    id: 'msg-1',
    session_id: 'session-1',
    user_id: 'user-1',
    role: 'bob',
    msg_type: 'text',
    content_text: 'Hello',
    content_json: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('mapStoredMessagesToConversation (T7.6)', () => {
  it('maps bob role to model and user role to user', () => {
    const result = mapStoredMessagesToConversation([
      stored({ role: 'bob', content_text: 'Hi there' }),
      stored({ role: 'user', content_text: 'Hello Bob' }),
    ]);
    expect(result).toEqual([
      { role: 'model', text: 'Hi there' },
      { role: 'user', text: 'Hello Bob' },
    ]);
  });

  it('skips non-text message types', () => {
    const result = mapStoredMessagesToConversation([
      stored({ msg_type: 'evaluation', content_text: 'ignored' }),
      stored({ msg_type: 'text', content_text: 'kept' }),
    ]);
    expect(result).toEqual([{ role: 'model', text: 'kept' }]);
  });

  it('skips messages without content_text', () => {
    const result = mapStoredMessagesToConversation([
      stored({ content_text: null }),
    ]);
    expect(result).toEqual([]);
  });

  it('returns an empty array for an empty history', () => {
    expect(mapStoredMessagesToConversation([])).toEqual([]);
  });
});
