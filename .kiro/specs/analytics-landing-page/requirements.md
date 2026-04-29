# Requirements Document

## Introduction

This release ships two capabilities for Yupp: a privacy-respecting analytics layer using PostHog wired into ten high-signal events across the application, and a marketing landing page at `/` that explains what Yupp is, showcases the product, and routes visitors into the app at `/app`. It also handles the consequences of that route split — the PWA manifest `start_url`, the share-target action, and the existing redirects — so that installed PWAs and shared links continue to work seamlessly.

The current application lives at `/` as a single-page app shell. After this release, `/` becomes a static marketing landing page and the interactive app shell moves to `/app`. All existing deep links, share targets, and PWA installs must continue to function correctly through this transition.

## Glossary

- **PostHog_SDK**: The PostHog JavaScript client library (`posthog-js`) used for event tracking, user identification, and feature flags.
- **Analytics_Provider**: The React context provider component at `src/components/AnalyticsProvider.tsx` that initialises PostHog_SDK on mount and provides tracking methods to the component tree.
- **Tracked_Event**: A named analytics event captured via `posthog.capture()` with a defined set of properties.
- **Consent_Banner**: A dismissible UI banner displayed to first-time visitors requesting opt-in consent for analytics tracking.
- **Consent_Store**: The mechanism (localStorage key `analytics_consent`) used to persist the user's analytics consent choice.
- **Landing_Page**: The static marketing page rendered at the `/` route, built as a Next.js server component.
- **App_Shell**: The interactive application (map, MagicBar, planner, drawers) previously at `/`, now served at `/app`.
- **Hero_Section**: The top fold of the Landing_Page containing the headline, subheadline, CTA button, and product screenshot.
- **Features_Section**: The section of the Landing_Page showcasing three key product capabilities with icons and descriptions.
- **How_It_Works_Section**: The section of the Landing_Page explaining the three-step user flow (Paste → Pin → Plan).
- **CTA_Section**: The bottom section of the Landing_Page with a final call-to-action button routing to `/app`.
- **OG_Image**: The Open Graph image at `public/og-image.png` used for social media link previews of the Landing_Page.
- **PWA_Manifest**: The web app manifest file at `public/manifest.json` defining PWA metadata, icons, and share target.
- **Share_Target**: The PWA manifest `share_target` configuration that receives shared URLs from the operating system.
- **Privacy_Page**: The static page at `/privacy` displaying the Yupp privacy policy.
- **Terms_Page**: The static page at `/terms` displaying the Yupp terms of service.
- **Pin_Store**: The Zustand store at `src/store/useTravelPinStore.ts` managing pin and collection state.
- **Planner_Store**: The Zustand store at `src/store/usePlannerStore.ts` managing itinerary and planned-pin state.
- **MagicBar**: The `MagicBar` component providing URL input and scrape processing.
- **PlaceSheet**: The `PlaceSheet` vaul drawer component displaying pin details.
- **Bottom_Nav**: The `BottomNav` component providing primary tab navigation.

## Requirements

### Requirement 1: PostHog SDK Integration

**User Story:** As a product owner, I want PostHog integrated into the application with a clean provider pattern, so that analytics events can be captured across all client components without polluting individual component logic.

#### Acceptance Criteria

1. THE Analytics_Provider SHALL initialise PostHog_SDK using the environment variables `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` on client-side mount.
2. THE Analytics_Provider SHALL be rendered in the root layout (`src/app/layout.tsx`) wrapping all page content so that PostHog_SDK is available to every client component.
3. THE Analytics_Provider SHALL disable PostHog_SDK autocapture, session recording, and heatmaps by passing `autocapture: false`, `disable_session_recording: true`, and `enable_heatmaps: false` in the initialisation config.
4. IF the `NEXT_PUBLIC_POSTHOG_KEY` environment variable is missing or empty, THEN THE Analytics_Provider SHALL skip PostHog_SDK initialisation entirely and log a warning to the console.
5. THE Analytics_Provider SHALL export a `trackEvent(eventName: string, properties?: Record<string, unknown>)` helper function that guards against uninitialised PostHog_SDK state before calling `posthog.capture()`.
6. THE Analytics_Provider SHALL be located at `src/components/AnalyticsProvider.tsx` and SHALL be a `'use client'` component.

### Requirement 2: Tracked Events

**User Story:** As a product analyst, I want ten high-signal events tracked across the user journey, so that I can measure activation, engagement, and retention funnels.

#### Acceptance Criteria

1. WHEN a user successfully creates a pin via the MagicBar URL processing flow, THE MagicBar SHALL capture a `pin_created` Tracked_Event with properties: `source_platform` (string), `pin_id` (string), and `pin_count` (number of total pins after creation).
2. WHEN a user opens the PlaceSheet for a pin, THE PlaceSheet SHALL capture a `pin_viewed` Tracked_Event with properties: `pin_id` (string) and `source_platform` (string).
3. WHEN a user creates a new itinerary in the Planner_Store, THE Planner_Store SHALL capture an `itinerary_created` Tracked_Event with properties: `itinerary_id` (string).
4. WHEN a user adds a pin to an itinerary day in the planner, THE Planner_Store SHALL capture a `pin_planned` Tracked_Event with properties: `itinerary_id` (string), `pin_id` (string), and `day_number` (number).
5. WHEN a user taps the "Open in Google Maps" button in the PlaceSheet, THE PlaceSheet SHALL capture a `directions_opened` Tracked_Event with properties: `pin_id` (string).
6. WHEN a user shares a trip via the share functionality, THE application SHALL capture a `trip_shared` Tracked_Event with properties: `itinerary_id` (string) and `share_method` (string).
7. WHEN a user completes authentication (sign-up or login), THE application SHALL capture a `user_signed_up` Tracked_Event with properties: `auth_method` (string).
8. WHEN a user taps the CTA button on the Landing_Page, THE Landing_Page SHALL capture a `landing_cta_clicked` Tracked_Event with properties: `section` (string indicating which CTA was clicked).
9. WHEN a user scrolls past the Hero_Section on the Landing_Page, THE Landing_Page SHALL capture a `landing_scroll_depth` Tracked_Event with properties: `section` (string indicating the deepest section reached).
10. WHEN a user opens the app for the first time in a session, THE Analytics_Provider SHALL capture an `app_opened` Tracked_Event with properties: `is_pwa` (boolean indicating standalone display mode) and `pin_count` (number of existing pins).

### Requirement 3: User Identification

**User Story:** As a product analyst, I want authenticated users linked to their PostHog profiles, so that I can track user journeys across sessions and devices.

#### Acceptance Criteria

1. WHEN a user authenticates successfully (Supabase auth state changes to a non-anonymous user), THE Analytics_Provider SHALL call `posthog.identify()` with the Supabase user ID as the distinct ID.
2. WHEN a user logs out, THE Analytics_Provider SHALL call `posthog.reset()` to clear the identified user and generate a new anonymous ID.
3. THE Analytics_Provider SHALL NOT call `posthog.identify()` for anonymous Supabase users (users where `user.is_anonymous` is true).

### Requirement 4: Consent Banner

**User Story:** As a privacy-conscious user, I want to be asked for consent before any analytics data is collected, so that my browsing behaviour is not tracked without my permission.

#### Acceptance Criteria

1. WHEN a user visits the application for the first time and no Consent_Store value exists, THE Consent_Banner SHALL be displayed as a fixed bottom banner above the Bottom_Nav.
2. THE Consent_Banner SHALL display a concise message explaining that Yupp uses analytics to improve the product, with links to the Privacy_Page and Terms_Page.
3. WHEN a user taps "Accept" on the Consent_Banner, THE Consent_Store SHALL persist the value `granted` and THE Analytics_Provider SHALL initialise PostHog_SDK tracking.
4. WHEN a user taps "Decline" on the Consent_Banner, THE Consent_Store SHALL persist the value `denied` and THE Analytics_Provider SHALL NOT initialise PostHog_SDK tracking.
5. WHILE the Consent_Store value is `denied`, THE Analytics_Provider SHALL NOT send any events to PostHog_SDK.
6. THE Consent_Banner SHALL not be displayed on the Landing_Page to avoid cluttering the marketing experience; consent SHALL only be requested when the user enters the App_Shell at `/app`.

### Requirement 5: Privacy Policy and Terms of Service Pages

**User Story:** As a user, I want to read the privacy policy and terms of service, so that I understand how my data is handled.

#### Acceptance Criteria

1. THE Privacy_Page SHALL be a static Next.js server component rendered at the `/privacy` route.
2. THE Terms_Page SHALL be a static Next.js server component rendered at the `/terms` route.
3. THE Privacy_Page SHALL include sections covering: data collected, how data is used, third-party services (PostHog), data retention, and user rights.
4. THE Terms_Page SHALL include sections covering: acceptable use, intellectual property, limitation of liability, and governing law.
5. THE Privacy_Page and Terms_Page SHALL include a navigation link back to the Landing_Page and a link to the App_Shell.
6. THE Landing_Page footer SHALL include links to the Privacy_Page and Terms_Page.

### Requirement 6: App Shell Route Migration

**User Story:** As a developer, I want the interactive app to live at `/app` instead of `/`, so that the root route can serve a marketing landing page while the PWA and all deep links continue to work.

#### Acceptance Criteria

1. THE App_Shell SHALL be served at the `/app` route by moving the current `src/app/page.tsx` content to `src/app/app/page.tsx`.
2. THE App_Shell layout at `src/app/app/layout.tsx` SHALL retain all existing functionality including the QueryProvider, ToastContainer, and viewport configuration.
3. THE PWA_Manifest `start_url` SHALL be updated from `/` to `/app` so that installed PWAs open directly to the App_Shell.
4. THE PWA_Manifest `share_target.action` SHALL be updated from `/share` to `/app/share` so that shared URLs are received by the App_Shell.
5. THE Share_Target page SHALL be moved from `src/app/share/page.tsx` to `src/app/app/share/page.tsx` and its redirect target SHALL be updated from `/?autoPaste=` to `/app?autoPaste=`.
6. THE existing `/share` route SHALL redirect to `/app/share` with all query parameters preserved, so that old shared links continue to work.
7. THE trip detail route SHALL be moved from `src/app/trip/[id]/page.tsx` to `src/app/app/trip/[id]/page.tsx`.
8. THE existing `/trip/[id]` route SHALL redirect to `/app/trip/[id]` so that old trip links continue to work.
9. THE admin routes at `/admin` SHALL remain at their current paths and SHALL NOT be affected by the route migration.

### Requirement 7: Landing Page

**User Story:** As a first-time visitor, I want to see a compelling landing page that explains what Yupp is and how it works, so that I understand the value proposition and am motivated to try the app.

#### Acceptance Criteria

1. THE Landing_Page SHALL be a static Next.js server component rendered at the `/` route.
2. THE Landing_Page SHALL include a Hero_Section with a headline ("Turn travel inspo into real plans"), a subheadline explaining the core value proposition, a primary CTA button ("Start Pinning — It's Free") linking to `/app`, and a product screenshot or mockup image.
3. THE Landing_Page SHALL include a Features_Section showcasing three key capabilities: AI-powered place extraction from social media links, visual map-based pin board, and drag-and-drop trip planner.
4. THE Landing_Page SHALL include a How_It_Works_Section with three numbered steps: Paste a link, Pin it to the map, Plan your trip.
5. THE Landing_Page SHALL include a CTA_Section at the bottom with a final call-to-action button ("Get Started Free") linking to `/app`.
6. THE Landing_Page SHALL include a footer with links to the Privacy_Page, Terms_Page, and the App_Shell.
7. THE Landing_Page SHALL be fully responsive, rendering correctly on mobile (320px), tablet (768px), and desktop (1280px) viewports.
8. THE Landing_Page SHALL use the existing Design_Token_System colors, typography, and radius tokens for visual consistency with the App_Shell.
9. THE Landing_Page SHALL set appropriate Open Graph metadata (`og:title`, `og:description`, `og:image`, `og:url`) for social media link previews.
10. THE Landing_Page SHALL achieve a Lighthouse performance score suitable for a static marketing page by using no client-side JavaScript bundles beyond the Next.js runtime.

### Requirement 8: OG Image and Static Assets

**User Story:** As a marketer, I want a branded Open Graph image and proper static assets, so that shared links to Yupp look professional on social media platforms.

#### Acceptance Criteria

1. THE application SHALL include an OG_Image file at `public/og-image.png` with dimensions of 1200×630 pixels.
2. THE OG_Image SHALL feature the Yupp brand name, tagline, and a visual representation of the product.
3. THE Landing_Page metadata SHALL reference the OG_Image using the `og:image` meta tag with the full absolute URL.
4. THE Landing_Page metadata SHALL include `og:title` set to "YUPP | Turn Travel Inspo Into Real Plans".
5. THE Landing_Page metadata SHALL include `og:description` set to a concise description of the product value proposition.
6. THE Landing_Page metadata SHALL include `twitter:card` set to `summary_large_image` for optimal Twitter/X card rendering.

### Requirement 9: Documentation

**User Story:** As a developer onboarding to the project, I want clear documentation of the analytics setup and route structure, so that I can understand the system and add new events without guessing.

#### Acceptance Criteria

1. THE project SHALL include an `ANALYTICS.md` file in the repository root documenting: the PostHog setup, the list of all Tracked_Events with their properties, the consent flow, and instructions for adding new events.
2. THE `ANALYTICS.md` SHALL include a table listing each Tracked_Event name, its trigger location (component or store), and its property schema.
3. THE project README SHALL be updated to document the new route structure (`/` for Landing_Page, `/app` for App_Shell, `/privacy`, `/terms`).

### Requirement 10: Testing

**User Story:** As a developer, I want automated tests covering the analytics provider, consent flow, and route redirects, so that regressions are caught before deployment.

#### Acceptance Criteria

1. THE Analytics_Provider SHALL have unit tests verifying: initialisation with valid config, skipping initialisation when the API key is missing, the `trackEvent` guard against uninitialised state, and the `identify`/`reset` lifecycle.
2. THE Consent_Banner SHALL have unit tests verifying: display when no consent exists, hiding after accept, hiding after decline, and persistence of consent choice to localStorage.
3. THE route redirect from `/share` to `/app/share` SHALL have a test verifying query parameter preservation.
4. THE route redirect from `/trip/[id]` to `/app/trip/[id]` SHALL have a test verifying the path parameter is preserved.
5. THE Landing_Page SHALL have a test verifying that all CTA links point to `/app` and that the page renders without client-side JavaScript errors.
6. FOR ALL valid Tracked_Event names and property objects, capturing then retrieving the event via the `trackEvent` helper SHALL produce a valid PostHog capture call with the correct event name and properties (round-trip property).
