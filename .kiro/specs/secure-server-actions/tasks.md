# Implementation Plan: Secure Server Actions

## Overview

Migrate itinerary mutation operations from client-side Supabase calls in `usePlannerStore` to secure Next.js Server Actions. Introduces a shared auth guard, `ActionResult` discriminated union type, input validation, and five itinerary Server Actions (create, delete, rename, save, clone). The Zustand store is then rewired to call these actions and handle structured results via toast notifications.

## Tasks

- [x] 1. Add ActionResult type and auth guard foundation
  - [x] 1.1 Add the `ActionResult<T>` discriminated union type to `src/types/index.ts`
    - Export `ActionResult<T = void>` with `{ success: true; data: T } | { success: false; error: string }`
    - _Requirements: 6.1, 6.2, 7.2_

  - [x] 1.2 Create `src/actions/auth.ts` with the `requireRegisteredUser` auth guard
    - Add `'use server'` directive
    - Accept a `SupabaseClient` parameter, call `supabase.auth.getUser()` (not `getSession()`)
    - Throw `"Unauthorized: No user session found"` when no session/user
    - Throw `"Unauthorized: Anonymous users cannot perform this action"` when `user.is_anonymous` is true
    - Return the `User` object for registered users
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1_

  - [ ]* 1.3 Write property test for auth guard — Property 1: Auth Guard Rejects All Non-Registered Users
    - **Property 1: Auth Guard Rejects All Non-Registered Users**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
    - Generate arbitrary user states (null user, error, anonymous user, registered user) and verify the three-partition behavior: no-session → throws "No user session found", anonymous → throws "Anonymous users cannot perform this action", registered → returns user unchanged

- [x] 2. Implement itinerary Server Actions with input validation
  - [x] 2.1 Create `src/actions/itineraryActions.ts` with input validation helpers
    - Add `'use server'` directive
    - Implement `validateName(name)` — reject empty/whitespace-only or >200 chars, return trimmed string
    - Implement `validateUUID(id)` — reject strings not matching UUID v4 regex
    - Implement `validateTripDate(date)` — accept null/undefined, reject non-string or invalid ISO dates
    - Define `UUID_REGEX` and `MAX_NAME_LENGTH` constants
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 2.2 Write property test for name validation — Property 2: Input Validation Rejects Invalid Names
    - **Property 2: Input Validation Rejects Invalid Names**
    - **Validates: Requirements 4.1, 4.2**
    - For arbitrary strings: `validateName(s)` throws iff `s.trim().length === 0` or `s.length > 200`; otherwise returns `s.trim()`

  - [ ]* 2.3 Write property test for UUID validation — Property 3: UUID Validation
    - **Property 3: UUID Validation**
    - **Validates: Requirements 4.3**
    - For arbitrary strings: `validateUUID(s)` succeeds iff `s` matches the UUID v4 regex — no false positives or negatives

  - [x] 2.4 Implement `createItineraryAction` in `src/actions/itineraryActions.ts`
    - Create Supabase SSR client, call `requireRegisteredUser`, validate name and optional trip date
    - Insert into `itineraries` table with `user_id`, return `ActionResult<Itinerary>`
    - Wrap entire body in try/catch, return failure `ActionResult` on any exception
    - _Requirements: 2.1, 2.4, 4.1, 4.4, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 2.5 Implement `deleteItineraryAction` in `src/actions/itineraryActions.ts`
    - Auth guard, validate UUID, delete with `.eq('user_id', user.id)` ownership scope
    - Return `ActionResult<void>`
    - _Requirements: 2.2, 2.4, 4.3, 6.5, 6.6_

  - [x] 2.6 Implement `renameItineraryAction` in `src/actions/itineraryActions.ts`
    - Auth guard, validate UUID and new name, update with ownership scope
    - Return `ActionResult<void>`
    - _Requirements: 2.3, 2.4, 4.2, 4.3, 6.5, 6.6_

  - [x] 2.7 Implement `saveItineraryAction` in `src/actions/itineraryActions.ts`
    - Auth guard, validate itinerary UUID, validate each day item (valid pin UUID, non-negative integer day number)
    - Delete existing items for itinerary (ownership via RLS), insert new items
    - Return `ActionResult<void>`
    - _Requirements: 3.1, 3.3, 4.3, 4.5, 6.5, 6.6_

  - [x] 2.8 Implement `cloneItineraryAction` in `src/actions/itineraryActions.ts`
    - Auth guard, validate source UUID, fetch source itinerary, create new itinerary owned by caller
    - Copy all itinerary items from source to new itinerary
    - Return `ActionResult<string>` with new itinerary ID, or failure if source not found
    - _Requirements: 3.2, 3.3, 3.4, 4.3, 6.5, 6.6_

  - [ ]* 2.9 Write property test — Property 4: Server Actions Never Throw
    - **Property 4: Server Actions Never Throw**
    - **Validates: Requirements 6.6**
    - For all Server Actions with arbitrary valid/invalid inputs and mocked dependency failures: the action always returns an `ActionResult` object and never throws an unhandled exception

  - [ ]* 2.10 Write property test — Property 5: Ownership Scope on Mutations
    - **Property 5: Ownership Scope on Mutations**
    - **Validates: Requirements 2.2, 2.3, 3.1**
    - Verify that delete, rename, and save actions include `.eq('user_id', user.id)` in their Supabase query builder calls via mock verification

- [x] 3. Checkpoint — Verify server actions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Migrate Planner Store to use Server Actions
  - [x] 4.1 Migrate `createItinerary` in `usePlannerStore` to call `createItineraryAction`
    - Import `createItineraryAction` from `@/actions/itineraryActions`
    - Replace direct Supabase client usage with Server Action call
    - Handle `ActionResult`: update state on success, show toast on failure via `useToastStore`
    - _Requirements: 5.1, 5.7_

  - [x] 4.2 Migrate `deleteItinerary` in `usePlannerStore` to call `deleteItineraryAction`
    - Replace direct Supabase delete with Server Action call
    - Update local state only on `result.success === true`
    - Show toast on failure
    - _Requirements: 5.2, 5.7_

  - [x] 4.3 Migrate `renameItinerary` in `usePlannerStore` to call `renameItineraryAction`
    - Replace direct Supabase update with Server Action call
    - Update local state only on success
    - Show toast on failure
    - _Requirements: 5.3, 5.7_

  - [x] 4.4 Migrate `saveItinerary` in `usePlannerStore` to call `saveItineraryAction`
    - Serialize `dayItems` into flat `{ pinId, dayNumber, sortOrder }[]` array
    - Replace direct Supabase delete+insert with Server Action call
    - Handle success/failure via `ActionResult`
    - _Requirements: 5.4, 5.7_

  - [x] 4.5 Migrate `cloneItinerary` in `usePlannerStore` to call `cloneItineraryAction`
    - Replace direct Supabase clone logic with Server Action call
    - On success, call `loadItinerary` with the returned new itinerary ID
    - Show toast on failure
    - _Requirements: 5.5, 5.7_

  - [x] 4.6 Remove direct `@/utils/supabase/client` import from mutation paths in `usePlannerStore`
    - Keep client import only for read operations (`fetchItineraries`, `loadItinerary`)
    - Verify no mutation method still uses the browser Supabase client
    - _Requirements: 5.6_

  - [ ]* 4.7 Write unit tests for store migration — Property 7: Store State Consistency After Server Action Failure
    - **Property 7: Store State Consistency After Server Action Failure**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.7**
    - Mock Server Actions to return failure `ActionResult`, verify store state is unchanged after each mutation call and that a toast error was triggered

- [x] 5. Checkpoint — Verify full integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 6. Write integration test for save round-trip — Property 6
  - [ ]* 6.1 Write property test — Property 6: Save Itinerary Round-Trip
    - **Property 6: Save Itinerary Round-Trip**
    - **Validates: Requirements 3.1, 5.4**
    - For arbitrary valid day item arrays: calling `saveItineraryAction(id, items)` followed by loading the itinerary produces items matching the saved pin IDs, day numbers, and sort orders

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirement clauses for traceability
- Property tests validate the 7 correctness properties defined in the design document
- Read operations (`fetchItineraries`, `loadItinerary`) remain on the browser Supabase client — they are SELECT-only and RLS-protected
- The `src/actions/itineraryActions.ts` file serves as the reference implementation for future pin/collection Server Actions (Requirement 7.4)
