// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { isActiveTick, clampSeconds, HEARTBEAT_INTERVAL_MS } from '@/lib/usage/heartbeat';

vi.mock('@/lib/usage/send-usage', () => ({
  sendUsage: vi.fn(),
}));

import { sendUsage } from '@/lib/usage/send-usage';
import { useUsageHeartbeat } from '@/hooks/useUsageHeartbeat';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

describe('isActiveTick / clampSeconds — pure', () => {
  it('is active only when visible and recently interacted', () => {
    expect(isActiveTick({ visible: true, lastInteractionAt: 0, now: 1000 })).toBe(true);
    expect(isActiveTick({ visible: false, lastInteractionAt: 0, now: 1000 })).toBe(false);
    expect(isActiveTick({ visible: true, lastInteractionAt: 0, now: 3 * 60_000 })).toBe(false);
  });

  it('clamps seconds between 0 and 150', () => {
    expect(clampSeconds(-5)).toBe(0);
    expect(clampSeconds(30)).toBe(30);
    expect(clampSeconds(500)).toBe(150);
  });
});

describe('useUsageHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(sendUsage).mockClear();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends active seconds on a visible, active tab', async () => {
    const { unmount } = renderHook(() => useUsageHeartbeat('cambridge_ket_reading'));

    window.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);

    expect(sendUsage).toHaveBeenCalledWith('cambridge_ket_reading', 120);
    unmount();
  });

  it('does not send while the tab is hidden', async () => {
    setVisibility('hidden');
    renderHook(() => useUsageHeartbeat('cambridge_ket_reading'));

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);

    expect(sendUsage).not.toHaveBeenCalled();
  });

  it('does not send after more than 2 minutes without interaction', async () => {
    renderHook(() => useUsageHeartbeat('cambridge_ket_reading'));

    await vi.advanceTimersByTimeAsync(3 * 60_000);

    expect(sendUsage).not.toHaveBeenCalled();
  });

  it('ticks every 120 seconds, not more often', async () => {
    renderHook(() => useUsageHeartbeat('cambridge_ket_reading'));
    window.dispatchEvent(new Event('keydown'));

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS - 1000);
    expect(sendUsage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(sendUsage).toHaveBeenCalledTimes(1);
    expect(HEARTBEAT_INTERVAL_MS).toBe(120_000);
  });

  it('caps a single tick at 150 seconds', () => {
    renderHook(() => useUsageHeartbeat('cambridge_ket_reading'));

    vi.setSystemTime(Date.now() + 170_000);
    window.dispatchEvent(new Event('keydown'));
    window.dispatchEvent(new Event('pagehide'));

    expect(sendUsage).toHaveBeenCalledWith('cambridge_ket_reading', 150);
  });

  it('does nothing when there is no active mode', async () => {
    renderHook(() => useUsageHeartbeat(null));

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);

    expect(sendUsage).not.toHaveBeenCalled();
  });
});
