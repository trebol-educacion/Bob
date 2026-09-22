// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { isActiveTick, clampSeconds, HEARTBEAT_INTERVAL_MS } from '@/lib/usage/heartbeat';

vi.mock('@/actions/usage', () => ({
  trackUsageAction: vi.fn().mockResolvedValue({ ok: true }),
}));

import { trackUsageAction } from '@/actions/usage';
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

  it('clamps seconds between 0 and 60', () => {
    expect(clampSeconds(-5)).toBe(0);
    expect(clampSeconds(30)).toBe(30);
    expect(clampSeconds(500)).toBe(60);
  });
});

describe('useUsageHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(trackUsageAction).mockClear();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends active seconds on a visible, active tab', async () => {
    const { unmount } = renderHook(() => useUsageHeartbeat('cambridge_ket_reading'));

    window.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);

    expect(trackUsageAction).toHaveBeenCalledWith('cambridge_ket_reading', 30);
    unmount();
  });

  it('does not send while the tab is hidden', async () => {
    setVisibility('hidden');
    renderHook(() => useUsageHeartbeat('cambridge_ket_reading'));

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);

    expect(trackUsageAction).not.toHaveBeenCalled();
  });

  it('does not send after more than 2 minutes without interaction', async () => {
    renderHook(() => useUsageHeartbeat('cambridge_ket_reading'));

    await vi.advanceTimersByTimeAsync(3 * 60_000);

    expect(trackUsageAction).not.toHaveBeenCalled();
  });

  it('caps a single tick at 60 seconds', () => {
    renderHook(() => useUsageHeartbeat('cambridge_ket_reading'));

    window.dispatchEvent(new Event('keydown'));
    vi.setSystemTime(Date.now() + 90_000);
    window.dispatchEvent(new Event('pagehide'));

    expect(trackUsageAction).toHaveBeenCalledWith('cambridge_ket_reading', 60);
  });

  it('does nothing when there is no active mode', async () => {
    renderHook(() => useUsageHeartbeat(null));

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);

    expect(trackUsageAction).not.toHaveBeenCalled();
  });
});
