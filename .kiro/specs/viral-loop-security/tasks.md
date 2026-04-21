# Implementation Plan: Viral Loop & Security Layer

## Overview

Implement the viral growth loop and security hardening for the Yupp travel app. This includes a database migration for public itinerary sharing, a public trip page with social metadata, a clone engine for viral trip copying, geocode rate limiting, and a login gateway for the Plan tab. Tasks are ordered so each step builds on the previous, with no orphaned code.

## Tasks

- [x] 1. Database migration and type updates
  - [x] 1.1 Create `supabase/migrations/0003_public_sharing.sql` migration
    - Add `is_public BOOLEAN DEFAULT false` column to `itineraries` table
    - Drop and recreate `select_own_itineraries` RLS policy to allow SELECT when `user_id = auth.uid() OR is_public = true`
    - Drop and recreate `select_own_itinerary_items` RLS policy to allow SELECT when parent itinerary is owned or public
    - Drop and recreate `select_own_pins` RLS policy to allow SELECT for pins referenced by public itinerary items, in addition to owner access
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Add `PublicTripData` type to `src/types/index.ts`
    - Add `PublicTripData` interface: `{ itinerary: Itinerary & { isPublic: boolean }; plannedPins: PlannedPin[] }`
    - _Requirements: 2.1_

- [x] 2. Service-role client and rate limiter utilities
  - [x] 2.1 Create `src/utils/supabase/serviceRole.ts`
    - Export `createServiceRoleClient()` using `@supabase/supabase-js` `createClient` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
    - This client bypasses RLS and is only used server-side
    - Throw if `SUPABASE_SERVICE_ROLE_KEY` is missing
    - _Requirements: 2.1, 2.4_

  - [x] 2.2 Create `src/actions/rateLimit.ts` rate limiter module
    - Implement `checkRateLimit(ip: string): boolean` with an in-memory `Map<string, { count: number; windowStart: number }>`
    - Use a fixed window of 60,000ms and max 20 requests per IP
    - Return `true` if allowed, `false` if rate-limited
    - Auto-reset window when expired
    - Fall back to `'unknown'` IP when header is missing
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 2.3 Write property test for rate limiter enforcement
    - **Property 5: Rate limiter enforcement**
    - For any IP and sequence of N requests within one window, exactly `min(N, 20)` are allowed
    - Test file: `src/actions/__tests__/rateLimit.pbt.test.ts`
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5**

  - [ ]* 2.4 Write property test for rate limiter window reset
    - **Property 6: Rate limiter window reset**
    - After exhausting the limit in window W, a new window W+1 (≥60s later) allows up to 20 new requests
    - Test file: `src/actions/__tests__/rateLimit.pbt.test.ts`
    - **Validates: Requirements 7.4**

- [x] 3. Integrate rate limiter into geocodeLocation
  - [x] 3.1 Modify `src/actions/geocodeLocation.ts` to call `checkRateLimit`
    - Import `checkRateLimit` from `@/actions/rateLimit`
    - Import `headers` from `next/headers` to extract IP from `x-forwarded-for` or `x-real-ip`
    - At the top of `geocodeLocation`, extract IP and call `checkRateLimit(ip)`
    - If rate-limited, return `{ status: 'error', error: 'Too many requests. Please slow down!' }` without calling Google Places API
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Public trip page — server component and metadata
  - [x] 5.1 Create `src/app/trip/[id]/page.tsx` server component
    - Implement `TripPage` server component that fetches itinerary + items + pins using `createServiceRoleClient`
    - Return `notFound()` if itinerary does not exist or `is_public` is `false`
    - Join itinerary_items with pins, group by day_number, sort by sort_order
    - Pass `itinerary` and `plannedPins` as props to `PublicTripView` client component
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 5.2 Implement `generateMetadata` in `src/app/trip/[id]/page.tsx`
    - Export `generateMetadata` function that fetches itinerary via service-role client
    - Set `og:title` to `Trip to [City]: [Itinerary Name] on Yupp` where City is derived from first Pin's address
    - Set `og:image` to first Pin's `imageUrl` if at least one Pin has a non-empty `imageUrl`; omit `og:image` if no valid image exists
    - Return 404-appropriate metadata if itinerary not found or private
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 5.3 Write property test for OG title format
    - **Property 2: OG title format**
    - For any itinerary with a non-empty name and at least one pin with a non-empty address, `generateMetadata` produces `og:title` matching `Trip to [City]: [Itinerary Name] on Yupp`
    - Test file: `src/app/trip/__tests__/generateMetadata.pbt.test.ts`
    - **Validates: Requirements 4.2**

  - [ ]* 5.4 Write property test for OG image selection
    - **Property 3: OG image selection**
    - If at least one pin has a non-empty `imageUrl`, `og:image` is set to the first pin's `imageUrl`; if none have a valid `imageUrl`, `og:image` is omitted
    - Test file: `src/app/trip/__tests__/generateMetadata.pbt.test.ts`
    - **Validates: Requirements 4.3, 4.4**

- [x] 6. Public trip page — client component (PublicTripView)
  - [x] 6.1 Create `src/components/PublicTripView.tsx` client component
    - Accept `itinerary` and `plannedPins` props
    - Render a full-screen MapLibre map with all pins as markers (read-only, interactions limited to pan/zoom)
    - Render a read-only Timeline Overlay listing pins grouped by day_number and sorted by sort_order
    - Display itinerary name and trip date in the Timeline Overlay header
    - Render a prominent "Copy this Trip to my Yupp" button
    - _Requirements: 3.1, 3.2, 3.3, 5.1_

  - [ ]* 6.2 Write property test for PlannedPins timeline ordering
    - **Property 1: PlannedPins timeline ordering**
    - For any array of PlannedPins, grouping by day_number and sorting by sort_order ascending produces correctly ordered groups
    - Test file: `src/components/__tests__/PublicTripView.pbt.test.ts`
    - **Validates: Requirements 3.2**

- [x] 7. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Clone engine
  - [x] 8.1 Add `cloneItinerary` action to `src/store/usePlannerStore.ts`
    - Add `cloneItinerary: (sourceItineraryId: string) => Promise<string | null>` to `PlannerStore` interface
    - Fetch source itinerary + items + pins via authenticated Supabase client (RLS allows SELECT on public itineraries)
    - Create a new itinerary row owned by the current user with the same name
    - Batch-insert new itinerary_items preserving `day_number` and `sort_order`
    - Call `loadItinerary` on the new itinerary ID
    - Return new itinerary ID on success, `null` on failure
    - If user is not authenticated, return `null` and log error without creating any DB rows
    - If source fetch fails, log error and do not create a partial itinerary
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 8.2 Write property test for clone round-trip preservation
    - **Property 4: Clone round-trip preservation**
    - For any valid public itinerary with N items across D days, cloning then loading produces PlannedPins with matching `day_number` and `sort_order` values
    - Test file: `src/store/__tests__/cloneItinerary.pbt.test.ts`
    - **Validates: Requirements 6.3, 6.6**

- [x] 9. Wire clone button and auth gate in PublicTripView
  - [x] 9.1 Implement clone button behavior in `src/components/PublicTripView.tsx`
    - When a logged-in user clicks "Copy this Trip to my Yupp", invoke `usePlannerStore.getState().cloneItinerary(itineraryId)`
    - On successful clone, navigate to the main app (`/`) with the cloned itinerary loaded
    - When an unauthenticated user clicks the button, display the AuthModal with message "Log in to save and plan your own trips."
    - _Requirements: 5.2, 5.3, 5.4_

- [x] 10. Login gateway for Plan tab
  - [x] 10.1 Modify `src/components/AuthModal.tsx` to accept optional `message` prop
    - Add optional `message?: string` to `AuthModalProps`
    - When `message` is provided and user is not authenticated, display it above the sign-in button
    - _Requirements: 8.2_

  - [x] 10.2 Modify `src/components/AppLayout.tsx` to gate the Plan tab
    - In `handleTabChange`, before opening the planner for the `'plan'` tab, check `useTravelPinStore.getState().user`
    - If `user` is `null`, open AuthModal with message "Log in to save and plan your own trips." instead of toggling the planner
    - Do not change `activeTab` to `'plan'` when user is unauthenticated
    - When user is authenticated, open the planner sidebar as normal
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 10.3 Write unit tests for login gateway behavior
    - Test unauthenticated plan tab click opens AuthModal with correct message
    - Test authenticated plan tab click opens planner
    - Test unauthenticated plan tab does not change activeTab
    - Test file: `src/components/__tests__/AppLayout.loginGateway.test.ts`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 11. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check`
- The project uses TypeScript, Next.js 14, Supabase, Zustand, MapLibre GL, and Vitest
