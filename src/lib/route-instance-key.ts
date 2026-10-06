import type { ActivityRenderProps } from '@/lib/routing';

export function ylInstanceKey(p: ActivityRenderProps): string {
  return p.initialMessages && p.initialMessages.length > 0
    ? p.sessionId ?? 'new'
    : 'new';
}
