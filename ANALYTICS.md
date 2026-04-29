# Analytics

Yupp uses [PostHog](https://posthog.com) for product analytics with a consent-first approach.

## PostHog Setup

### Environment Variables

Add these to `.env.local`:

```
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

If `NEXT_PUBLIC_POSTHOG_KEY` is missing or empty, PostHog initialisation is skipped entirely and a warning is logged to the console. The app continues to function normally without analytics.

### Provider Location

The `AnalyticsProvider` component lives at `src/components/AnalyticsProvider.tsx` and is rendered in the root layout (`src/app/layout.tsx`), wrapping all page content. It:

- Reads consent from `localStorage` on mount
- Conditionally initialises PostHog (only when consent is `granted`)
- Exports a `trackEvent(event, properties?)` helper for use in components and stores
- Handles user identification (`posthog.identify` / `posthog.reset`) based on Supabase auth state

PostHog is configured with `autocapture: false`, `disable_session_recording: true`, and `enable_heatmaps: false` — only the explicit events listed below are tracked.

## Tracked Events

| Event | Trigger Location | Properties |
|-------|-----------------|------------|
| `pin_created` | `MagicBar` component | `source_platform` (string), `pin_id` (string), `pin_count` (number) |
| `pin_viewed` | `PlaceSheet` component | `pin_id` (string), `source_platform` (string) |
| `itinerary_created` | `PlannerStore` | `itinerary_id` (string) |
| `pin_planned` | `PlannerStore` | `itinerary_id` (string), `pin_id` (string), `day_number` (number) |
| `directions_opened` | `PlaceSheet` component | `pin_id` (string) |
| `trip_shared` | `PlaceSheet` component | `itinerary_id` (string), `share_method` (string) |
| `user_signed_up` | `useCloudSync` hook | `auth_method` (string) |
| `landing_cta_clicked` | `LandingScrollTracker` component | `section` (string) |
| `landing_scroll_depth` | `LandingScrollTracker` component | `section` (string) |
| `app_opened` | `AnalyticsProvider` component | `is_pwa` (boolean), `pin_count` (number) |

Event name constants are defined in `src/utils/analytics.ts` as the `EVENTS` object.

## Consent Flow

Analytics tracking requires explicit user consent. The flow works as follows:

1. **First visit to `/app`** — No `analytics_consent` key exists in `localStorage`. The `ConsentBanner` component (`src/components/ConsentBanner.tsx`) renders as a fixed bottom banner above the navigation.

2. **User taps "Accept"** — `localStorage` is set to `analytics_consent = 'granted'`. A `consent-granted` window event is dispatched. The `AnalyticsProvider` initialises PostHog and begins capturing events.

3. **User taps "Decline"** — `localStorage` is set to `analytics_consent = 'denied'`. PostHog is never initialised. All `trackEvent` calls are no-ops.

4. **Subsequent visits** — The `AnalyticsProvider` reads the stored consent value on mount. If `granted`, PostHog initialises automatically. If `denied` (or any other value), no tracking occurs.

The consent banner is only shown inside the App Shell (`/app`), not on the landing page.

### localStorage Key

- **Key:** `analytics_consent`
- **Values:** `'granted'` | `'denied'` | absent (no decision yet)

## Adding New Events

1. **Add the event name** to the `EVENTS` constant in `src/utils/analytics.ts`:
   ```ts
   export const EVENTS = {
     // ... existing events
     MY_NEW_EVENT: 'my_new_event',
   } as const;
   ```

2. **Call `trackEvent`** in the relevant component or store:
   ```ts
   import { trackEvent } from '@/components/AnalyticsProvider';
   import { EVENTS } from '@/utils/analytics';

   trackEvent(EVENTS.MY_NEW_EVENT, { some_property: 'value' });
   ```
   For components, you can also use the `useTrackEvent` hook from `AnalyticsProvider`.

3. **Update this document** — add a row to the Tracked Events table above with the event name, trigger location, and property schema.
