import type { YLRenderProps } from '@/lib/routing';

export function ylInstanceKey(p: YLRenderProps): string {
  return p.initialMessages && p.initialMessages.length > 0
    ? p.sessionId ?? 'new'
    : 'new';
}
