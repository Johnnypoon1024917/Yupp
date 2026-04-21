import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { checkRateLimit, _resetStore, MAX_REQUESTS, WINDOW_MS } from '../rateLimit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    _resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first request from a new IP', () => {
    expect(checkRateLimit('1.2.3.4')).toBe(true);
  });

  it('allows up to MAX_REQUESTS in one window', () => {
    for (let i = 0; i < MAX_REQUESTS; i++) {
      expect(checkRateLimit('1.2.3.4')).toBe(true);
    }
  });

  it('rejects the request after MAX_REQUESTS in one window', () => {
    for (let i = 0; i < MAX_REQUESTS; i++) {
      checkRateLimit('1.2.3.4');
    }
    expect(checkRateLimit('1.2.3.4')).toBe(false);
  });

  it('resets the window after WINDOW_MS elapses', () => {
    for (let i = 0; i < MAX_REQUESTS; i++) {
      checkRateLimit('1.2.3.4');
    }
    expect(checkRateLimit('1.2.3.4')).toBe(false);

    vi.advanceTimersByTime(WINDOW_MS);

    expect(checkRateLimit('1.2.3.4')).toBe(true);
  });

  it('tracks different IPs independently', () => {
    for (let i = 0; i < MAX_REQUESTS; i++) {
      checkRateLimit('1.1.1.1');
    }
    expect(checkRateLimit('1.1.1.1')).toBe(false);
    expect(checkRateLimit('2.2.2.2')).toBe(true);
  });

  it('falls back to "unknown" for empty IP string', () => {
    for (let i = 0; i < MAX_REQUESTS; i++) {
      checkRateLimit('');
    }
    expect(checkRateLimit('')).toBe(false);
    // A real IP should still be allowed
    expect(checkRateLimit('9.9.9.9')).toBe(true);
  });

  it('exports correct constants', () => {
    expect(WINDOW_MS).toBe(60_000);
    expect(MAX_REQUESTS).toBe(20);
  });
});
