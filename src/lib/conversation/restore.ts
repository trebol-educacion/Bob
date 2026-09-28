import type { ChatMessage } from '@/actions/gemini';
import type { StoredMessage } from '@/actions/messages';

/**
 * @param stored StoredMessage[]
 * @returns ChatMessage[]
 */
export function mapStoredMessagesToConversation(stored: StoredMessage[]): ChatMessage[] {
  return stored
    .filter(m => m.msg_type === 'text' && typeof m.content_text === 'string')
    .map(m => ({
      role: m.role === 'bob' ? 'model' : 'user',
      text: m.content_text ?? '',
    }));
}
