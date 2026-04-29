// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import posthog from 'posthog-js';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), reset: vi.fn() },
}));

// Mock the store so the module can be imported without Zustand issues
vi.mock('@/store/useTravelPinStore', () => {
  const store = Object.assign(
    vi.fn((selector: (s: Record<string, unknown>) => unknown) => {
      return selector({ pins: [], user: null });
    }),
    {
      getState: () => ({ pins: [], user: null }),
      subscribe: vi.fn(() => vi.fn()),
    },
  );
  return { default: store };
});

// jsdom provides window + localStorage, but its localStorage may be incomplete.
// Provide a polyfill if needed.
if (typeof globalThis.localStorage?.clear !== 'function') {
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
    writable: true,
    configurable: true,
  });
}

describe('trackEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('analytics_consent');
  });

  it('calls posthog.capture when consent is granted', async () => {
    localStorage.setItem('analytics_consent', 'granted');
    const { trackEvent } = await import('@/components/AnalyticsProvider');
    trackEvent('test_event', { foo: 'bar' });
    expect(posthog.capture).toHaveBeenCalledWith('test_event', { foo: 'bar' });
  });

  it('does NOT call posthog.capture when consent is denied', async () => {
    localStorage.setItem('analytics_consent', 'denied');
    const { trackEvent } = await import('@/components/AnalyticsProvider');
    trackEvent('test_event', { foo: 'bar' });
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('does NOT call posthog.capture when no consent key exists', async () => {
    const { trackEvent } = await import('@/components/AnalyticsProvider');
    trackEvent('test_event');
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('is a no-op when window is undefined (server-side)', async () => {
    const origWindow = globalThis.window;
    // @ts-expect-error — simulating server environment
    delete globalThis.window;
    try {
      const { trackEvent } = await import('@/components/AnalyticsProvider');
      trackEvent('test_event', { a: 1 });
      expect(posthog.capture).not.toHaveBeenCalled();
    } finally {
      globalThis.window = origWindow;
    }
  });
});
