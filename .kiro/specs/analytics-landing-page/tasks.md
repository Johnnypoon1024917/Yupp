# Implementation Tasks

## Task 1: Install PostHog dependency and add environment variables
- [x] 1.1 Install `posthog-js` package as a production dependency
- [x] 1.2 Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.local.example`

## Task 2: Create analytics utilities and AnalyticsProvider
- [x] 2.1 Create `src/utils/analytics.ts` with event name constants and `EventName` type
- [x] 2.2 Create `src/components/AnalyticsProvider.tsx` with PostHog init, consent check, trackEvent helper, identify/reset lifecycle, and app_opened event
- [x] 2.3 Add `AnalyticsProvider` to root layout (`src/app/layout.tsx`) wrapping children

## Task 3: Create ConsentBanner component
- [x] 3.1 Create `src/components/ConsentBanner.tsx` with accept/decline buttons, localStorage persistence, and privacy/terms links

## Task 4: Route migration — move App Shell to `/app`
- [x] 4.1 Create `src/app/app/page.tsx` with the current app shell content (import AppLayout)
- [x] 4.2 Create `src/app/app/layout.tsx` with ConsentBanner
- [x] 4.3 Move share handler to `src/app/app/share/page.tsx` and update redirect target from `/` to `/app`
- [x] 4.4 Move trip page to `src/app/app/trip/[id]/page.tsx` (copy existing server component)
- [x] 4.5 Replace `src/app/share/page.tsx` with a redirect stub to `/app/share` preserving query params
- [x] 4.6 Replace `src/app/trip/[id]/page.tsx` with a redirect stub to `/app/trip/[id]`
- [x] 4.7 Update `public/manifest.json` — set `start_url` to `/app` and `share_target.action` to `/app/share`

## Task 5: Create Landing Page at `/`
- [x] 5.1 Replace `src/app/page.tsx` with the landing page server component (Hero, Features, How It Works, CTA, Footer sections) with OG metadata
- [x] 5.2 Create `src/components/LandingScrollTracker.tsx` for scroll depth and CTA click tracking

## Task 6: Create Privacy and Terms pages
- [x] 6.1 Create `src/app/privacy/page.tsx` with privacy policy content
- [x] 6.2 Create `src/app/terms/page.tsx` with terms of service content

## Task 7: Wire analytics events into existing components
- [x] 7.1 Add `pin_created` event to MagicBar after successful pin creation
- [x] 7.2 Add `pin_viewed` and `directions_opened` events to PlaceSheet
- [x] 7.3 Add `itinerary_created` event to PlannerStore `createItinerary`
- [x] 7.4 Add `pin_planned` event to PlannerStore `addPinToDay`
- [x] 7.5 Add `user_signed_up` event to useCloudSync on auth state change
- [x] 7.6 Add `trip_shared` event to the share functionality

## Task 8: Create OG image and update static assets
- [x] 8.1 Create placeholder `public/og-image.png` (1200×630 branded image)

## Task 9: Create documentation
- [x] 9.1 Create `ANALYTICS.md` with PostHog setup, event table, consent flow, and instructions for adding new events
- [x] 9.2 Update `README.md` with new route structure documentation

## Task 10: Write tests
- [x] 10.1 Write unit tests for AnalyticsProvider (init, skip init, trackEvent guard, identify/reset)
- [x] 10.2 Write unit tests for ConsentBanner (display, accept, decline, persistence)
- [x] 10.3 Write tests for route redirects (/share → /app/share, /trip/[id] → /app/trip/[id])
- [x] 10.4 Write test for Landing Page CTA links pointing to /app
- [x] 10.5 [PBT] Write property-based test: for all valid event names and arbitrary property objects, trackEvent passes them through to posthog.capture unchanged when consent is granted
