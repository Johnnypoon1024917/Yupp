# Implementation Plan: Google Places Geocoding

## Overview

Replace the Nominatim geocoder with Google Places API (New) Text Search and add a Human-in-the-Loop clarification UI in the MagicBar. Implementation proceeds bottom-up: types first, then server action, then UI, then tests, with checkpoints between layers.

## Tasks

- [x] 1. Update type definitions
  - [x] 1.1 Add `EnrichedData` interface and replace `GeocodeResult`/`GeocodeError` with discriminated union in `src/types/index.ts`
    - Remove the existing `GeocodeResult` and `GeocodeError` interfaces
    - Add `EnrichedData` interface with `placeId` (string), `primaryType` (optional string), `rating` (optional number)
    - Add `GeocodeResult` discriminated union type with three variants: `SUCCESS` (lat, lng, displayName, enrichedData), `NEEDS_USER_INPUT` (partialData with title and imageUrl), `ERROR` (error string)
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 2. Rewrite `geocodeLocation` server action
  - [x] 2.1 Remove all Nominatim code and implement Google Places Text Search in `src/actions/geocodeLocation.ts`
    - Delete all Nominatim constants, types, rate-limiting logic, `queryNominatim`, `getViewboxFromHints`, and `selectBestResult` functions
    - Keep the `'use server'` directive
    - Add input validation: return ERROR for empty/whitespace-only location, return ERROR if `GOOGLE_PLACES_API_KEY` env var is missing (no fetch call in either case)
    - Build `textQuery` by combining location string with first contextual hint (comma-separated) when hints are provided, or location alone when no hints
    - POST to `https://places.googleapis.com/v1/places:searchText` with `Content-Type`, `X-Goog-Api-Key`, and `X-Goog-FieldMask` headers
    - Use `AbortController` with 10-second timeout
    - Apply confidence logic: exactly 1 result → SUCCESS with lat, lng, displayName, enrichedData; 0 or 2+ results → NEEDS_USER_INPUT with partialData; non-OK HTTP → ERROR with status code; network error/timeout → ERROR with descriptive message
    - Update function signature to accept optional `partialData` parameter and return the new `GeocodeResult` union type
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3_

  - [ ]* 2.2 Write property test: Query construction (Property 1)
    - **Property 1: Query construction combines location and hints correctly**
    - Generate random non-empty location strings and contextual hint arrays. Mock fetch to capture request body. Assert `textQuery` equals `"<location>, <firstHint>"` when hints non-empty, or `"<location>"` when hints empty.
    - File: `src/actions/__tests__/geocodeLocation.pbt.test.ts`
    - **Validates: Requirements 2.1, 9.1, 9.2**

  - [ ]* 2.3 Write property test: Single result maps to SUCCESS (Property 2)
    - **Property 2: Single result maps to SUCCESS with correct fields**
    - Generate random single-place Google Places responses with arbitrary lat, lng, displayName, id, primaryType, rating. Assert SUCCESS variant with correct field mapping.
    - File: `src/actions/__tests__/geocodeLocation.pbt.test.ts`
    - **Validates: Requirements 3.1**

  - [ ]* 2.4 Write property test: Non-single result maps to NEEDS_USER_INPUT (Property 3)
    - **Property 3: Non-single result count maps to NEEDS_USER_INPUT**
    - Generate 0 or 2+ place responses with arbitrary partialData. Assert NEEDS_USER_INPUT with partialData preserved.
    - File: `src/actions/__tests__/geocodeLocation.pbt.test.ts`
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 2.5 Write property test: HTTP error maps to ERROR with status code (Property 4)
    - **Property 4: Non-OK HTTP status maps to ERROR with status code**
    - Generate random HTTP status codes in 400–599 range. Assert ERROR variant whose error string contains the numeric status code.
    - File: `src/actions/__tests__/geocodeLocation.pbt.test.ts`
    - **Validates: Requirements 2.6**

  - [ ]* 2.6 Write property test: Network errors map to ERROR (Property 5)
    - **Property 5: Network errors map to ERROR with descriptive message**
    - Generate random Error objects thrown by fetch (including timeout aborts). Assert ERROR variant with non-empty descriptive error string.
    - File: `src/actions/__tests__/geocodeLocation.pbt.test.ts`
    - **Validates: Requirements 3.4**

  - [ ]* 2.7 Write property test: API key never leaked (Property 6)
    - **Property 6: API key is never leaked in any response variant**
    - Generate various inputs across all code paths with a known API key. Assert the API key string is absent from all fields of the returned GeocodeResult.
    - File: `src/actions/__tests__/geocodeLocation.pbt.test.ts`
    - **Validates: Requirements 8.3**

  - [ ]* 2.8 Write property test: Whitespace-only input returns ERROR (Property 7)
    - **Property 7: Whitespace-only input returns ERROR without network request**
    - Generate whitespace-only strings (spaces, tabs, newlines, empty). Assert ERROR variant returned and fetch was never called.
    - File: `src/actions/__tests__/geocodeLocation.pbt.test.ts`
    - **Validates: Requirements 9.3**

  - [ ]* 2.9 Write unit tests for `geocodeLocation`
    - Verify `X-Goog-FieldMask` header value is `places.location,places.displayName,places.primaryType,places.rating,places.id`
    - Verify `X-Goog-Api-Key` header matches env var value
    - Verify missing API key returns ERROR without calling fetch
    - Verify 10-second timeout is configured via AbortController
    - File: `src/actions/__tests__/geocodeLocation.test.ts`
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [x] 3. Checkpoint — Ensure all geocodeLocation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update MagicBar component
  - [x] 4.1 Add `needs_input` state and clarification flow to `src/components/MagicBar.tsx`
    - Update `MagicBarState` type to include `'needs_input'`
    - Add `partialData` state (`{ title: string; imageUrl: string | null } | null`)
    - Add `clarificationValue` state (string)
    - Update `handleSubmit` to handle the new `GeocodeResult` discriminated union: check `result.status` instead of `result.success`
    - On `status === 'needs_user_input'`: store partialData from scrape result, transition to `needs_input` state
    - On `status === 'success'`: create pin using `result.lat`, `result.lng`, `result.displayName`, transition to `success` state
    - On `status === 'error'`: transition to `error` state with `result.error`
    - Add clarification submit handler: call `geocodeLocation({ location: clarificationValue })` without contextual hints; on SUCCESS create pin; on ERROR or NEEDS_USER_INPUT stay in `needs_input` state
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.6, 6.7, 6.8_

  - [x] 4.2 Implement Needs-Input UI in `src/components/MagicBar.tsx`
    - Render expanded area when `state === 'needs_input'` using Framer Motion `layout` prop for smooth expansion
    - Display scraped thumbnail (48×48 rounded) from `partialData.imageUrl` on the left
    - Display prompt text: "We saved the vibe! Where exactly is this?"
    - Render text input for venue name or address, Enter to submit
    - Use `rounded-2xl`, `backdrop-blur-md`, and crisp border styling consistent with existing MagicBar design
    - Use spring animation with `stiffness: 400, damping: 30`
    - No red error styling or error icons in this state
    - _Requirements: 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3_

  - [ ]* 4.3 Write unit tests for MagicBar state transitions and needs-input UI
    - Test state transitions: SUCCESS → `success`, ERROR → `error`, NEEDS_USER_INPUT → `needs_input`
    - Test needs-input UI renders thumbnail, prompt text, and input field
    - Test clarification submit calls geocodeLocation with user input
    - Test clarification SUCCESS creates pin
    - Test clarification failure stays in `needs_input` state
    - File: `src/components/__tests__/MagicBar.test.tsx`
    - _Requirements: 5.2, 5.3, 5.4, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 5. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate the 7 correctness properties defined in the design document using fast-check
- The scraper (`scrapeUrl`) and its types (`ScrapeResult`, `ScrapeError`) are unchanged
- The `Pin` interface and store (`useTravelPinStore`) are unchanged
