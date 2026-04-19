# Implementation Plan: Discovery Experience Polish

## Overview

Surgical updates across three files to improve geocoder intelligence (confidence-based place selection), PlaceSheet editorial typography, and CTA styling. All changes build incrementally: types and constants first, then core logic, then UI, then wiring validation.

## Tasks

- [x] 1. Update Google Places field mask and response type
  - [x] 1.1 Add `places.userRatingCount` to the `FIELD_MASK` constant in `src/actions/geocodeLocation.ts`
    - Append `,places.userRatingCount` to the existing field mask string
    - _Requirements: 5.1_

  - [x] 1.2 Add `userRatingCount` to the `GooglePlacesResponse` type in `src/actions/geocodeLocation.ts`
    - Add `userRatingCount?: number` to the place object interface
    - _Requirements: 5.2_

- [x] 2. Rewrite `pickProminentPlace` with confidence-based selection
  - [x] 2.1 Rewrite `pickProminentPlace` in `src/actions/geocodeLocation.ts` with the new priority order
    - Step 1: Contextual hint match on `formattedAddress` only (not `displayName`)
    - Step 2: Rating > 4.2 AND `userRatingCount` > 50 on first result
    - Step 3: Ambiguity check — same `displayName` (case-insensitive) + coords within 0.05°
    - Step 4: Default to first result
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 4.1_

  - [x] 2.2 Export `pickProminentPlace` for testing
    - Change from `function pickProminentPlace` to `export function pickProminentPlace`
    - Also export the `GooglePlace` type so tests can construct test data
    - _Requirements: 1.1, 2.1, 4.1_

  - [x]* 2.3 Write property test: Contextual hint matching on formattedAddress
    - **Property 1: Contextual hint matching on formattedAddress**
    - Generate arrays of 2–5 places with random `formattedAddress` values
    - Generate a hint that matches exactly one address (case-insensitive)
    - Verify that place is returned; also verify fallthrough when no hint matches
    - Create file `src/actions/__tests__/geocodeLocation.pbt.test.ts`
    - **Validates: Requirements 1.1, 1.3**

  - [x]* 2.4 Write property test: Rating-based prominence selection
    - **Property 2: Rating-based prominence selection**
    - Generate places with no hint matches
    - Vary `rating` around 4.2 boundary and `userRatingCount` around 50
    - Verify selection only when both thresholds are exceeded
    - **Validates: Requirements 2.1, 2.2**

  - [x]* 2.5 Write property test: Ambiguity detection
    - **Property 3: Ambiguity detection**
    - Generate two places with same `displayName` and coords within 0.05°
    - Ensure no hint match and no rating match apply
    - Verify `null` is returned; also verify non-null when names differ or coords are distant
    - **Validates: Requirements 4.1**

- [x] 3. Checkpoint — Geocoder logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update PlaceSheet typography and CTA styles
  - [x] 4.1 Fix description typography in `src/components/PlaceSheet.tsx`
    - Change `leading-[20px]` → `leading-[22px]` on both description paragraphs (caption and "Saved from" fallback)
    - Change `tracking-[0.2px]` → `tracking-[0.1px]` on both description paragraphs
    - _Requirements: 8.2_

  - [x] 4.2 Fix divider margins in `src/components/PlaceSheet.tsx`
    - Change the divider above description from `my-[20px]` → `mt-[24px] mb-[24px]`
    - _Requirements: 8.1_

  - [x] 4.3 Fix CTA button styles in `src/components/PlaceSheet.tsx`
    - Change `rounded-[16px]` → `rounded-[28px]`
    - Change `bg-[#111111]` → `bg-black`
    - Change `text-[15px]` → `text-[16px]`
    - _Requirements: 9.1_

- [x] 5. Write example-based tests for geocoder
  - [x]* 5.1 Create example-based tests in `src/actions/__tests__/geocodeLocation.test.ts`
    - Mock `fetch` to return canned Google Places responses
    - Test address field populated from `formattedAddress` (Req 3.2)
    - Test address fallback to `displayName.text` when `formattedAddress` is missing (Req 3.3)
    - Test zero results → `needs_user_input` (Req 4.3)
    - Test `FIELD_MASK` includes `places.userRatingCount` (Req 5.1)
    - _Requirements: 3.2, 3.3, 4.3, 5.1_

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- No new files are created aside from test files
- Requirements 6, 7, 10 (title typography, address display, portrait frame) are already correctly implemented — no tasks needed
