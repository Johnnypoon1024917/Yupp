// @vitest-environment jsdom
/**
 * **Validates: Requirements 1.2**
 *
 * Property-based test: for all valid event names and arbitrary property objects,
 * trackEvent passes them through to posthog.capture unchanged when consent is granted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import posthog from 'posthog-js';
import { trackEvent } from '@/components/AnalyticsProvider';
import { EVENTS } from '@/utils/analytics';

// Mock posthog
vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), reset: vi.fn() },
}));

// Mock the store
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

// jsdom localStorage polyfill
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

const EVENT_VALUES = Object.values(EVENTS);

describe('trackEvent round-trip property', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('analytics_consent', 'granted');
  });

  it('passes event name and properties through to posthog.capture unchanged', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EVENT_VALUES),
        fc.dictionary(fc.string({ minLength: 1 }), fc.jsonValue()),
        (eventName, properties) => {
          vi.mocked(posthog.capture).mockClear();
          trackEvent(eventName, properties as Record<string, unknown>);
          expect(posthog.capture).toHaveBeenCalledWith(eventName, properties);
        }
      )
    );
  });
});
