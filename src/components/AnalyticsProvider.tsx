'use client';

import { useEffect, useCallback, createContext, useContext, useRef } from 'react';
import posthog from 'posthog-js';
import useTravelPinStore from '@/store/useTravelPinStore';

const CONSENT_KEY = 'analytics_consent';

type TrackFn = (event: string, properties?: Record<string, unknown>) => void;

const AnalyticsContext = createContext<TrackFn>(() => {});

export function useTrackEvent() {
  return useContext(AnalyticsContext);
}

// Standalone helper for non-component code (stores)
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const consent = localStorage.getItem(CONSENT_KEY);
  if (consent !== 'granted') return;
  try {
    posthog.capture(event, properties);
  } catch {
    // PostHog not initialised — silently ignore
  }
}

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const initialisedRef = useRef(false);

  const initPostHog = useCallback(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!key) {
      console.warn('[Analytics] NEXT_PUBLIC_POSTHOG_KEY is missing — skipping init');
      return;
    }

    if (initialisedRef.current) return;
    initialisedRef.current = true;

    posthog.init(key, {
      api_host: host || 'https://us.i.posthog.com',
      autocapture: false,
      disable_session_recording: true,
      enable_heatmaps: false,
      persistence: 'localStorage',
      loaded: (ph) => {
        // Capture app_opened on first load
        const isPwa = window.matchMedia('(display-mode: standalone)').matches;
        const pinCount = useTravelPinStore.getState().pins.length;
        ph.capture('app_opened', { is_pwa: isPwa, pin_count: pinCount });
      },
    });
  }, []);

  // Check consent on mount
  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent === 'granted') {
      initPostHog();
    }

    // Listen for consent-granted event (from ConsentBanner)
    const handleConsentGranted = () => {
      initPostHog();
    };
    window.addEventListener('consent-granted', handleConsentGranted);
    return () => {
      window.removeEventListener('consent-granted', handleConsentGranted);
    };
  }, [initPostHog]);

  // User identification: watch auth state
  useEffect(() => {
    const unsubscribe = useTravelPinStore.subscribe((state, prevState) => {
      if (state.user === prevState.user) return;

      if (state.user && !state.user.is_anonymous) {
        try { posthog.identify(state.user.id); } catch {}
      } else if (!state.user && prevState.user) {
        try { posthog.reset(); } catch {}
      }
    });
    return unsubscribe;
  }, []);

  const track: TrackFn = useCallback((event, properties) => {
    trackEvent(event, properties);
  }, []);

  return (
    <AnalyticsContext.Provider value={track}>
      {children}
    </AnalyticsContext.Provider>
  );
}
