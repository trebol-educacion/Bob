// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendUsage, USAGE_ENDPOINT } from '@/lib/usage/send-usage';

describe('sendUsage', () => {
  const originalBeacon = navigator.sendBeacon;

  afterEach(() => {
    Object.defineProperty(navigator, 'sendBeacon', { value: originalBeacon, configurable: true });
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  it('posts a JSON blob to /api/usage with sendBeacon', async () => {
    const beacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });

    sendUsage('cambridge_ket_reading', 120);

    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0] as [string, Blob];
    expect(url).toBe(USAGE_ENDPOINT);
    expect(blob.type).toBe('application/json');
    expect(JSON.parse(await blob.text())).toEqual({ mode: 'cambridge_ket_reading', seconds: 120 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to keepalive fetch when the beacon is rejected', () => {
    Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn().mockReturnValue(false), configurable: true });

    sendUsage('cambridge_ket_reading', 30);

    expect(fetch).toHaveBeenCalledWith(USAGE_ENDPOINT, expect.objectContaining({ method: 'POST', keepalive: true }));
  });

  it('never throws when the transport fails', () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: vi.fn().mockImplementation(() => { throw new Error('boom'); }),
      configurable: true,
    });
    expect(() => sendUsage('m', 10)).not.toThrow();
  });
});
