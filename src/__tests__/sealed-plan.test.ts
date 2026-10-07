import { describe, expect, it, vi } from 'vitest';
import { sealPlan, unsealPlan } from '@/lib/session/sealed-plan';

describe('sealed plan', () => {
  const plan = { questions: [{ number: 1, answer: 'B' }] };

  it('round-trips for the same user', () => {
    expect(unsealPlan(sealPlan(plan, 'user-1'), 'user-1')).toEqual(plan);
  });

  it('rejects another user', () => {
    expect(unsealPlan(sealPlan(plan, 'user-1'), 'user-2')).toBeNull();
  });

  it('rejects tampered and malformed tokens', () => {
    const token = sealPlan(plan, 'user-1');
    const tampered = `${token.slice(0, -2)}AA`;
    expect(unsealPlan(tampered, 'user-1')).toBeNull();
    expect(unsealPlan('x', 'user-1')).toBeNull();
  });

  it('does not expose the answer key in the token', () => {
    const token = sealPlan(plan, 'user-1');
    expect(Buffer.from(token, 'base64url').toString('utf8')).not.toContain('answer');
  });

  it('rejects expired plans', () => {
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const token = sealPlan(plan, 'user-1');
    spy.mockReturnValue(now + 4 * 60 * 60 * 1000);
    expect(unsealPlan(token, 'user-1')).toBeNull();
    spy.mockRestore();
  });
});
