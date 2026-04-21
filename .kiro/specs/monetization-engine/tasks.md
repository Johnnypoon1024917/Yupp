# Implementation Plan: Monetization Engine

## Overview

Implement affiliate booking links, click tracking, and social proof badges in the travel workstation. The plan starts with the pure affiliate link utility (testable in isolation), adds the database migration, builds the server action for click tracking, then wires everything into the PlaceSheet component.

## Tasks

- [x] 1. Implement affiliate link utility
  - [x] 1.1 Create `src/utils/affiliateLinks.ts` with `getAffiliateLink` and `extractCity` functions
    - Define the `AffiliateLinkResult` interface with `url`, `platformName`, `label`, `bgColor`
    - Implement `extractCity(address)` — extract city from comma-separated address (second-to-last segment, or full string if no commas)
    - Implement `getAffiliateLink(pin)` — return `null` for missing/unrecognized `primaryType`; map hotel/lodging → Booking.com, restaurant/food/cafe → TripAdvisor, tourist_attraction/museum/park → Klook
    - URI-encode title and city components in generated URLs
    - Omit city component when `address` is undefined
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x]* 1.2 Write property test: Category-to-platform mapping (Property 1)
    - **Property 1: Category-to-platform mapping with correct URL construction**
    - Generate arbitrary Pins with recognized `primaryType` keywords and varying `title`/`address` combinations
    - Assert returned `url` starts with the correct platform base URL
    - Assert decoded URL contains the URI-encoded pin title
    - Assert decoded URL contains the URI-encoded city when address is provided, and omits it when address is undefined
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.6, 1.7**

  - [x]* 1.3 Write property test: Unrecognized or missing primaryType returns null (Property 2)
    - **Property 2: Unrecognized or missing primaryType returns null**
    - Generate arbitrary Pins with `primaryType` set to `undefined` or random strings not containing any recognized keywords
    - Assert `getAffiliateLink` returns `null`
    - **Validates: Requirements 1.4, 1.5**

  - [x]* 1.4 Write property test: Affiliate URL round-trip validity (Property 3)
    - **Property 3: Affiliate URL round-trip validity**
    - For any Pin that produces a non-null result, assert `new URL(result.url)` does not throw
    - **Validates: Requirements 1.8**

- [x] 2. Checkpoint — Verify affiliate link utility
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create click tracking infrastructure
  - [x] 3.1 Create Supabase migration `supabase/migrations/0004_referral_clicks.sql`
    - Create `referral_clicks` table with columns: `id` (UUID PK), `user_id` (UUID FK nullable), `pin_id` (UUID NOT NULL), `platform_name` (TEXT NOT NULL), `created_at` (TIMESTAMPTZ default now())
    - Enable Row Level Security
    - Create policy for authenticated users to insert their own rows (`user_id = auth.uid()`)
    - Create policy for anonymous inserts (`user_id IS NULL`)
    - _Requirements: 3.1, 3.5_

  - [x] 3.2 Create server action `src/actions/trackReferralClick.ts`
    - Implement `trackReferralClick({ pinId, platformName })` as a `'use server'` action
    - Create Supabase server client, read auth session (nullable)
    - Insert row into `referral_clicks` with `user_id` from session or `null`
    - Return `{ success: true }` on success, `{ success: false }` on error (log server-side)
    - _Requirements: 3.2, 3.3, 3.4_

  - [x]* 3.3 Write unit tests for `trackReferralClick`
    - Test that authenticated user click inserts row with correct `user_id`, `pin_id`, `platform_name`
    - Test that anonymous user click inserts row with `null` `user_id`
    - Test that tracking failure returns `{ success: false }` without throwing
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 4. Integrate affiliate buttons and social proof badge into PlaceSheet
  - [x] 4.1 Add social proof badge to PlaceSheet header
    - Render "🔥 Popular" pill badge when `pin.rating` exists and is `> 4.5`
    - Place badge in the header area after the title `<h2>` and before the address
    - Use warm background (`bg-orange-50`), orange text, `rounded-full` pill styling
    - Do not render badge when rating is `<= 4.5` or undefined
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 4.2 Add "Plan Your Visit" affiliate button section to PlaceSheet
    - Import `getAffiliateLink` and `trackReferralClick`
    - Call `getAffiliateLink(pin)` and conditionally render the section only when result is non-null
    - Add "Plan Your Visit" header text above the affiliate button
    - Render branded button with label, background color, and white text from `AffiliateLinkResult`
    - Place section between the description/vibe area and the meta row
    - On click: open affiliate URL via `window.open(url, '_blank', 'noopener,noreferrer')` and fire-and-forget call `trackReferralClick({ pinId: pin.id, platformName: result.platformName })`
    - Do not render any affiliate section when `getAffiliateLink` returns `null`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.2, 3.4_

  - [x]* 4.3 Write unit tests for PlaceSheet monetization features
    - Test hotel-type pin renders "Book Stay" button with `#003580` background
    - Test attraction-type pin renders "Get Tickets" button with `#FF5B00` background
    - Test restaurant-type pin renders "Reserve Table" button with branded background
    - Test affiliate button has `target="_blank"` and `rel="noopener noreferrer"` semantics
    - Test pin with no matching category renders no affiliate button
    - Test "Plan Your Visit" header renders above affiliate button
    - Test pin with rating 4.6 displays "🔥 Popular" badge
    - Test pin with rating 4.5 does not display badge
    - Test pin with undefined rating does not display badge
    - Test badge has warm background and rounded-full styling
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.1, 4.2, 4.3, 4.4_

- [x] 5. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The affiliate link utility is pure and side-effect-free, making it ideal for property-based testing
