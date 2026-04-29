# Design Document

## Overview

This design covers two parallel workstreams that ship together: (1) a PostHog analytics layer with consent management, and (2) a marketing landing page at `/` with the app shell relocated to `/app`. The design prioritises minimal disruption to existing code — analytics is additive (a provider + event calls), and the route migration uses Next.js App Router conventions with redirect stubs for backwards compatibility.

## Architecture

### Route Structure (After Migration)

```
/                  → Landing page (server component, static)
/app               → App shell (client component, interactive)
/app/share         → Share target handler (redirects to /app?autoPaste=...)
/app/trip/[id]     → Public trip view (server component)
/privacy           → Privacy policy (server component, static)
/terms             → Terms of service (server component, static)
/admin             → Admin panel (unchanged)
/share             → Redirect stub → /app/share (backwards compat)
/trip/[id]         → Redirect stub → /app/trip/[id] (backwards compat)
```

### Analytics Data Flow

```
User Action → Component calls trackEvent() → AnalyticsProvider checks consent
  → If consent === 'granted': posthog.capture(eventName, properties)
  → If consent !== 'granted': no-op
```

### Consent Flow

```
First visit to /app → No localStorage key → Show ConsentBanner
  → User taps "Accept" → localStorage.set('analytics_consent', 'granted') → init PostHog
  → User taps "Decline" → localStorage.set('analytics_consent', 'denied') → skip PostHog
```

## File Structure

### New Files

```
src/components/AnalyticsProvider.tsx    — PostHog provider + trackEvent helper
src/components/ConsentBanner.tsx        — Consent UI banner
src/app/page.tsx                        — Landing page (replaces current app shell)
src/app/app/page.tsx                    — App shell (moved from current /)
src/app/app/layout.tsx                  — App shell layout
src/app/app/share/page.tsx              — Share target (moved from /share)
src/app/app/trip/[id]/page.tsx          — Public trip (moved from /trip/[id])
src/app/share/page.tsx                  — Redirect stub to /app/share
src/app/trip/[id]/page.tsx              — Redirect stub to /app/trip/[id]
src/app/privacy/page.tsx                — Privacy policy page
src/app/terms/page.tsx                  — Terms of service page
src/utils/analytics.ts                  — Event name constants and type definitions
public/og-image.png                     — OG image (1200×630)
ANALYTICS.md                            — Analytics documentation
```

### Modified Files

```
src/app/layout.tsx                      — Add AnalyticsProvider wrapper
src/components/MagicBar.tsx             — Add pin_created event
src/components/PlaceSheet.tsx           — Add pin_viewed, directions_opened events
src/store/usePlannerStore.ts            — Add itinerary_created, pin_planned events
src/components/AuthModal.tsx            — Add user_signed_up event
src/hooks/useCloudSync.ts              — Add user_signed_up on auth state change
public/manifest.json                    — Update start_url and share_target.action
next.config.mjs                         — No changes needed (App Router handles routing)
README.md                               — Update route documentation
.env.local.example                      — Add NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST
```

## Component Designs

### 1. AnalyticsProvider (`src/components/AnalyticsProvider.tsx`)

A `'use client'` component that wraps the app tree. It reads consent from localStorage, conditionally initialises PostHog, and exports a `trackEvent` helper.

```tsx
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
```

### 2. ConsentBanner (`src/components/ConsentBanner.tsx`)

A fixed-position banner shown only in the App Shell when no consent decision exists.

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const CONSENT_KEY = 'analytics_consent';

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) setVisible(true);
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    setVisible(false);
    window.dispatchEvent(new Event('consent-granted'));
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'denied');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[60] rounded-card bg-surface border border-border shadow-elev-2 p-4"
         role="dialog" aria-label="Analytics consent">
      <p className="text-caption text-ink-2 mb-3">
        We use analytics to improve Yupp.{' '}
        <Link href="/privacy" className="underline text-brand">Privacy Policy</Link>
        {' · '}
        <Link href="/terms" className="underline text-brand">Terms</Link>
      </p>
      <div className="flex gap-2">
        <button onClick={handleAccept}
                className="flex-1 rounded-control bg-brand text-white text-caption py-2 font-medium">
          Accept
        </button>
        <button onClick={handleDecline}
                className="flex-1 rounded-control bg-surface-sunken text-ink-2 text-caption py-2 font-medium">
          Decline
        </button>
      </div>
    </div>
  );
}
```

### 3. Event Constants (`src/utils/analytics.ts`)

Type-safe event name constants to prevent typos across the codebase.

```ts
// Tracked event names — keep in sync with ANALYTICS.md
export const EVENTS = {
  PIN_CREATED: 'pin_created',
  PIN_VIEWED: 'pin_viewed',
  ITINERARY_CREATED: 'itinerary_created',
  PIN_PLANNED: 'pin_planned',
  DIRECTIONS_OPENED: 'directions_opened',
  TRIP_SHARED: 'trip_shared',
  USER_SIGNED_UP: 'user_signed_up',
  LANDING_CTA_CLICKED: 'landing_cta_clicked',
  LANDING_SCROLL_DEPTH: 'landing_scroll_depth',
  APP_OPENED: 'app_opened',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
```

### 4. Landing Page (`src/app/page.tsx`)

A server component with no client-side JS beyond Next.js runtime. Uses design tokens for styling consistency.

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Sparkles, Calendar } from 'lucide-react';
import LandingScrollTracker from '@/components/LandingScrollTracker';

export const metadata: Metadata = {
  title: 'YUPP | Turn Travel Inspo Into Real Plans',
  description: 'Paste a link from Instagram, TikTok, or Xiaohongshu. Yupp extracts the place, pins it on your map, and helps you plan the trip.',
  openGraph: {
    title: 'YUPP | Turn Travel Inspo Into Real Plans',
    description: 'Paste a link from Instagram, TikTok, or Xiaohongshu. Yupp extracts the place, pins it on your map, and helps you plan the trip.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YUPP | Turn Travel Inspo Into Real Plans',
    description: 'Paste a link from Instagram, TikTok, or Xiaohongshu.',
    images: ['/og-image.png'],
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface text-ink-1">
      {/* Hero */}
      <section className="px-6 pt-16 pb-20 text-center max-w-3xl mx-auto">
        <h1 className="text-display mb-4">Turn travel inspo into real plans</h1>
        <p className="text-body text-ink-2 mb-8 max-w-lg mx-auto">
          Paste a link from Instagram, TikTok, Xiaohongshu, or Douyin.
          Yupp extracts the place, pins it on your map, and helps you plan the trip.
        </p>
        <Link href="/app"
              className="inline-block rounded-pill bg-brand text-white px-8 py-3 text-headline font-semibold shadow-elev-1 hover:shadow-elev-2 transition-shadow">
          Start Pinning — It's Free
        </Link>
      </section>

      {/* Features */}
      <section className="px-6 py-16 bg-surface-raised">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            { icon: Sparkles, title: 'AI-Powered Extraction', desc: 'Paste any social media link. Our AI finds the place name, photos, and location.' },
            { icon: MapPin, title: 'Visual Pin Board', desc: 'See all your saved places on an interactive map. Organised by category automatically.' },
            { icon: Calendar, title: 'Trip Planner', desc: 'Drag pins into a day-by-day itinerary. Share your trip with friends.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-card bg-brand-soft text-brand mb-4">
                <Icon size={24} />
              </div>
              <h3 className="text-headline mb-2">{title}</h3>
              <p className="text-body text-ink-2">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-16">
        <h2 className="text-title text-center mb-12">How It Works</h2>
        <div className="max-w-3xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Paste a link', desc: 'Copy a URL from Instagram, TikTok, Xiaohongshu, or Douyin and paste it into Yupp.' },
            { step: '2', title: 'Pin it to the map', desc: 'Yupp extracts the place, geocodes it, and drops a pin on your personal map.' },
            { step: '3', title: 'Plan your trip', desc: 'Drag your pins into a day-by-day itinerary and share it with travel buddies.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-pill bg-brand text-white text-headline font-bold mb-4">
                {step}
              </div>
              <h3 className="text-headline mb-2">{title}</h3>
              <p className="text-body text-ink-2">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 py-20 text-center bg-surface-raised">
        <h2 className="text-title mb-4">Ready to plan your next trip?</h2>
        <Link href="/app"
              className="inline-block rounded-pill bg-brand text-white px-8 py-3 text-headline font-semibold shadow-elev-1 hover:shadow-elev-2 transition-shadow">
          Get Started Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-caption text-ink-3 border-t border-border">
        <div className="flex justify-center gap-4">
          <Link href="/privacy" className="hover:text-ink-2">Privacy</Link>
          <Link href="/terms" className="hover:text-ink-2">Terms</Link>
          <Link href="/app" className="hover:text-ink-2">Open App</Link>
        </div>
        <p className="mt-2">© {new Date().getFullYear()} Yupp</p>
      </footer>

      {/* Client-side scroll tracker for analytics */}
      <LandingScrollTracker />
    </div>
  );
}
```

### 5. LandingScrollTracker (`src/components/LandingScrollTracker.tsx`)

A lightweight client component for landing page scroll depth and CTA click tracking.

```tsx
'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/components/AnalyticsProvider';
import { EVENTS } from '@/utils/analytics';

export default function LandingScrollTracker() {
  useEffect(() => {
    // Track CTA clicks via event delegation
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[href="/app"]');
      if (target) {
        const section = target.closest('section');
        trackEvent(EVENTS.LANDING_CTA_CLICKED, {
          section: section?.dataset.section || 'unknown',
        });
      }
    };
    document.addEventListener('click', handleClick);

    // Track scroll depth with IntersectionObserver
    const sections = document.querySelectorAll('section[data-section]');
    const seen = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const name = (entry.target as HTMLElement).dataset.section;
          if (name && !seen.has(name)) {
            seen.add(name);
            trackEvent(EVENTS.LANDING_SCROLL_DEPTH, { section: name });
          }
        }
      }
    }, { threshold: 0.3 });

    sections.forEach((s) => observer.observe(s));

    return () => {
      document.removeEventListener('click', handleClick);
      observer.disconnect();
    };
  }, []);

  return null;
}
```

### 6. App Shell Route (`src/app/app/page.tsx`)

The existing app shell, moved to the `/app` route.

```tsx
import AppLayout from '@/components/AppLayout';

export default function AppPage() {
  return <AppLayout />;
}
```

### 7. App Shell Layout (`src/app/app/layout.tsx`)

Wraps the app shell with ConsentBanner. The root layout already provides AnalyticsProvider, QueryProvider, and ToastContainer.

```tsx
import ConsentBanner from '@/components/ConsentBanner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ConsentBanner />
    </>
  );
}
```

### 8. Share Redirect Stubs

**`src/app/share/page.tsx`** (backwards-compat redirect):
```tsx
import { redirect } from 'next/navigation';

export default async function ShareRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams(params).toString();
  redirect(`/app/share${qs ? `?${qs}` : ''}`);
}
```

**`src/app/app/share/page.tsx`** (actual share handler, moved from current `/share`):
```tsx
'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { extractSupportedUrl } from '@/utils/urlParsing';

function ShareRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const urlParam = searchParams.get('url') ?? '';
    const textParam = searchParams.get('text') ?? '';
    const extracted = extractSupportedUrl(urlParam) ?? extractSupportedUrl(textParam);

    if (extracted) {
      router.replace(`/app?autoPaste=${encodeURIComponent(extracted)}`);
    } else {
      router.replace('/app');
    }
  }, [searchParams, router]);

  return null;
}

export default function SharePage() {
  return (
    <Suspense fallback={null}>
      <ShareRedirect />
    </Suspense>
  );
}
```

### 9. Trip Redirect Stub (`src/app/trip/[id]/page.tsx`)

```tsx
import { redirect } from 'next/navigation';

export default async function TripRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/app/trip/${id}`);
}
```

### 10. Root Layout Update (`src/app/layout.tsx`)

Add AnalyticsProvider to the root layout so it's available to both landing page and app shell.

```tsx
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ToastContainer from "@/components/ToastContainer";
import QueryProvider from "@/components/QueryProvider";
import AnalyticsProvider from "@/components/AnalyticsProvider";

// ... existing font config ...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} font-sans antialiased bg-background text-primary`}>
        <AnalyticsProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
        </AnalyticsProvider>
        <ToastContainer />
      </body>
    </html>
  );
}
```

### 11. PWA Manifest Update (`public/manifest.json`)

```json
{
  "name": "YUPP Travel",
  "short_name": "YUPP",
  "description": "The AI-Powered Travel Command Center.",
  "start_url": "/app",
  "display": "standalone",
  "background_color": "#FAFAFA",
  "theme_color": "#FAFAFA",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "share_target": {
    "action": "/app/share",
    "method": "GET",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  }
}
```

## Event Integration Points

### MagicBar — `pin_created` event

After successful pin creation in `processUrl`, add:
```ts
import { trackEvent } from '@/components/AnalyticsProvider';
import { EVENTS } from '@/utils/analytics';

// Inside processUrl, after pinnedCount > 0:
trackEvent(EVENTS.PIN_CREATED, {
  source_platform: scrapeResult.platform,
  pin_id: newPin.id,
  pin_count: useTravelPinStore.getState().pins.length,
});
```

### PlaceSheet — `pin_viewed` and `directions_opened` events

```ts
// On mount/pin change:
useEffect(() => {
  if (pin) {
    trackEvent(EVENTS.PIN_VIEWED, {
      pin_id: pin.id,
      source_platform: pin.sourceUrl ? detectPlatform(pin.sourceUrl) : 'unknown',
    });
  }
}, [pin?.id]);

// On "Open in Google Maps" click:
trackEvent(EVENTS.DIRECTIONS_OPENED, { pin_id: pin.id });
```

### PlannerStore — `itinerary_created` and `pin_planned` events

```ts
// In createItinerary, after successful insert:
trackEvent(EVENTS.ITINERARY_CREATED, { itinerary_id: data.id });

// In addPinToDay:
trackEvent(EVENTS.PIN_PLANNED, {
  itinerary_id: usePlannerStore.getState().activeItinerary?.id,
  pin_id: pin.id,
  day_number: dayNumber,
});
```

### AuthModal / useCloudSync — `user_signed_up` event

```ts
// In useCloudSync onAuthStateChange, when event === 'SIGNED_IN':
trackEvent(EVENTS.USER_SIGNED_UP, { auth_method: 'google' });
```

## Privacy & Terms Pages

Both are simple server components with static content using design tokens. They share a minimal layout with a back-link to `/` and a link to `/app`.

```tsx
// src/app/privacy/page.tsx
export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-title mb-8">Privacy Policy</h1>
      {/* Static content sections */}
    </div>
  );
}
```

## Environment Variables

Add to `.env.local.example`:
```
# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## Dependencies

Add `posthog-js` to `dependencies`:
```
npm install posthog-js
```

## Testing Strategy

### Unit Tests

- **AnalyticsProvider**: Mock `posthog-js`, test init with/without API key, test trackEvent guard, test identify/reset lifecycle
- **ConsentBanner**: Mock localStorage, test visibility logic, test accept/decline persistence
- **Route redirects**: Test that `/share?url=x` redirects to `/app/share?url=x`, test that `/trip/abc` redirects to `/app/trip/abc`
- **Landing page**: Render test verifying CTA links point to `/app`

### Property-Based Test

- **trackEvent round-trip**: For all valid event names from the EVENTS constant and arbitrary property objects, calling `trackEvent(name, props)` should result in `posthog.capture` being called with exactly `(name, props)`. This verifies the helper doesn't mutate or drop data.

## Correctness Properties

| ID | Property | Type | Requirement |
|----|----------|------|-------------|
| P1 | For all valid event names and property objects, `trackEvent(name, props)` calls `posthog.capture(name, props)` with identical arguments when consent is granted | Round-trip | Req 1, 2 |
| P2 | ConsentBanner is visible iff localStorage has no `analytics_consent` key | Invariant | Req 4 |
| P3 | After accept, `localStorage.getItem('analytics_consent') === 'granted'` | Invariant | Req 4 |
| P4 | After decline, no `posthog.capture` calls are made regardless of trackEvent invocations | Invariant | Req 4 |
| P5 | `/share?url=X&text=Y` redirect preserves all query parameters in the target `/app/share?url=X&text=Y` | Round-trip | Req 6 |
| P6 | `/trip/{id}` redirect preserves the path parameter in `/app/trip/{id}` | Round-trip | Req 6 |
| P7 | All `<a href="/app">` elements on the landing page resolve to the `/app` route | Invariant | Req 7 |
