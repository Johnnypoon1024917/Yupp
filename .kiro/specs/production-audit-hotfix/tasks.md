# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Production Audit Multi-Bug Exploration
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each bug exists
  - **Scoped PBT Approach**: Scope each property to the concrete failing case(s) for reproducibility
  - Test the following bug conditions on UNFIXED code:
  - **1.1 Leaked API Key**: Assert `.env.local.example` contains no bare API key strings outside variable assignments (line 22 contains `AIzaSyDv99fpuGYfovsEsWQub4Rk_S9PS-8_XTY`)
  - **1.2 removePin Missing Cloud Delete**: For any authenticated user calling `removePin(pinId)`, assert a Supabase `delete` is issued on the `pins` table. Currently only local state is filtered.
  - **1.3 removePinFromDay Missing Dirty Flag**: For any `(dayNumber, pinId)`, assert `removePinFromDay` sets `hasUnsavedChanges = true`. Currently it does not.
  - **1.4 buildCollectionIdMap Index-Based Mapping**: For any `(localCollections, cloudCollections)` where Postgres return order differs from insert order, assert mapping uses name-based matching. Currently uses index `localCollections[i] → cloudCollections[i]`.
  - **1.5 Live-Sync Hardcoded collection_id**: For any newly-added pin with a non-unorganized `collectionId`, assert the Supabase insert uses the pin's actual `collectionId` resolved through the collection ID map. Currently hardcodes `unorganizedCloudId`.
  - **1.6 cloneItinerary FK/RLS Failure**: For any `sourceItineraryId` owned by a different user, assert `cloneItinerary` clones the underlying pins into the new user's account before inserting itinerary items. Currently copies `pin_id` references directly.
  - **1.9 VisualMarker DOM Exception**: For any scenario where `img.onerror` fires after the image element is already detached from `inner`, assert no DOM exception is thrown. Currently calls `inner.removeChild(img)` without guard.
  - **1.10 extractPlaces Missing Server Directive**: Assert `extractPlaces.ts` starts with `'use server'` directive. Currently missing.
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root causes
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.9, 1.10_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Production Audit Regression Prevention
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs, then write property-based tests asserting observed behavior:
  - **3.1 Unauthenticated removePin**: For any unauthenticated user calling `removePin(pinId)`, observe that only local state filtering occurs with no Supabase call. Write property asserting this continues.
  - **3.2 Existing Store Mutations**: For `addPin`, `updatePin`, `renameCollection` calls, observe they perform local state updates AND fire-and-forget Supabase persistence. Write property asserting pattern is unchanged.
  - **3.3 Other Planner Mutations Set Dirty Flag**: For `addPinToDay`, `reorderPinInDay`, `movePinBetweenDays`, observe they set `hasUnsavedChanges = true`. Write property asserting this continues.
  - **3.4 Default Collection Mapping**: For users with only the "Unorganized" collection, observe `buildCollectionIdMap` correctly maps the default collection. Write property asserting this continues after name-based matching change.
  - **3.5 Same-User cloneItinerary**: For `cloneItinerary` where source is owned by the same user, observe `day_number` and `sort_order` are preserved. Write property asserting this continues.
  - **3.7 Single Pin Map Fly**: For a single user-added pin, observe `MapView` flies to that pin's coordinates with cinematic animation. Write property asserting this continues.
  - **3.8 VisualMarker Successful Load**: For a pin where image loads successfully, observe the circular marker with hover animation displays. Write property asserting this continues.
  - **3.9 extractPlaces Server Functions**: For `parseLLMResponse`, `buildExtractionPrompt`, `detectPlatform` called from server-side, observe identical results. Write property asserting this continues.
  - **3.11 Env Example Structure**: For existing variable names in `.env.local.example`, observe same placeholder names and documentation structure. Write property asserting this continues.
  - Verify all preservation tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 3.9, 3.11_

- [x] 3. P0 Security: Remove leaked API key from `.env.local.example`

  - [x] 3.1 Remove the bare API key string `AIzaSyDv99fpuGYfovsEsWQub4Rk_S9PS-8_XTY` from line 22 of `.env.local.example`
    - Delete the bare key line, keep all existing placeholder variable assignments intact
    - Ensure no real API keys remain anywhere in the file
    - _Bug_Condition: isBugCondition(file) where file contains bare API key string outside variable assignment_
    - _Expected_Behavior: file contains only placeholder values (e.g., `your_google_api_key_here`)_
    - _Preservation: Existing variable names and documentation structure unchanged (3.11)_
    - _Requirements: 1.1, 2.1, 3.11_

  - [x] 3.2 Add `travel-pin-board.tar` to `.gitignore`
    - Append `travel-pin-board.tar` to `.gitignore` to prevent future tracking of the 56 MB archive
    - _Requirements: 1.12, 2.12_

- [x] 4. P0 Data Integrity: Fix `removePin` missing Supabase delete

  - [x] 4.1 Add fire-and-forget Supabase delete to `removePin` in `useTravelPinStore.ts`
    - After filtering the pin from local state, check if `state.user` is set
    - If authenticated, issue `supabase.from('pins').delete().eq('id', pinId)` following the same fire-and-forget pattern used by `updatePin` and `renameCollection`
    - If unauthenticated, do nothing (local-only filter as before)
    - _Bug_Condition: isBugCondition(call) where user is authenticated AND removePin is called_
    - _Expected_Behavior: local state filtered AND Supabase delete issued_
    - _Preservation: Unauthenticated users continue local-only filtering (3.1); other mutations unchanged (3.2)_
    - _Requirements: 1.2, 2.2, 3.1, 3.2_

  - [x] 4.2 Verify bug condition exploration test now passes for removePin
    - **Property 1: Expected Behavior** - removePin Cloud Delete
    - **IMPORTANT**: Re-run the SAME test from task 1 for bug 1.2 - do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.2_

  - [x] 4.3 Verify preservation tests still pass for removePin
    - **Property 2: Preservation** - removePin Regression Check
    - **IMPORTANT**: Re-run the SAME tests from task 2 for requirements 3.1, 3.2 - do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 5. P0 Data Integrity: Fix `removePinFromDay` missing dirty flag

  - [x] 5.1 Set `hasUnsavedChanges = true` in `removePinFromDay` in `usePlannerStore.ts`
    - In the `set()` callback, add `hasUnsavedChanges: true` to the returned state object alongside the updated `dayItems`
    - _Bug_Condition: isBugCondition(call) where removePinFromDay is called_
    - _Expected_Behavior: returned state includes `hasUnsavedChanges: true`_
    - _Preservation: addPinToDay, reorderPinInDay, movePinBetweenDays continue setting hasUnsavedChanges (3.3)_
    - _Requirements: 1.3, 2.3, 3.3_

  - [x] 5.2 Verify bug condition exploration test now passes for removePinFromDay
    - **Property 1: Expected Behavior** - removePinFromDay Dirty Flag
    - **IMPORTANT**: Re-run the SAME test from task 1 for bug 1.3 - do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.3_

  - [x] 5.3 Verify preservation tests still pass for planner mutations
    - **Property 2: Preservation** - Planner Mutations Regression Check
    - **IMPORTANT**: Re-run the SAME tests from task 2 for requirement 3.3 - do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 6. P0 Data Integrity: Fix `buildCollectionIdMap` index-based mapping in `useCloudSync.ts`

  - [x] 6.1 Replace index-based mapping with name-based matching in `buildCollectionIdMap`
    - Change the loop from `localCollections[i] → cloudCollections[i]` to matching by collection `name`
    - For each local collection, find the cloud collection with the same name and map their IDs
    - Handle edge case where no matching cloud collection exists (skip or fallback to unorganized)
    - _Bug_Condition: isBugCondition(localCollections, cloudCollections) where Postgres return order differs from insert order_
    - _Expected_Behavior: mapping uses name-based matching regardless of array order_
    - _Preservation: Default "Unorganized" collection mapping continues to work (3.4)_
    - _Requirements: 1.4, 2.4, 3.4_

  - [x] 6.2 Fix live-sync subscriber to use actual pin `collectionId` instead of hardcoded `unorganizedCloudId`
    - In the store subscriber (lines 316-371 of `useCloudSync.ts`), resolve each new pin's `collectionId` through the collection ID map
    - Replace the hardcoded `collection_id: unorganizedCloudId` with the resolved cloud collection ID
    - Fall back to `unorganizedCloudId` only when the pin's collection has no cloud mapping
    - _Bug_Condition: isBugCondition(pin) where pin.collectionId is not the unorganized collection_
    - _Expected_Behavior: Supabase insert uses resolved cloud collection ID from the map_
    - _Preservation: Pins in "Unorganized" collection continue to map correctly (3.4)_
    - _Requirements: 1.5, 2.5, 3.4_

  - [x] 6.3 Verify bug condition exploration tests now pass for cloud sync
    - **Property 1: Expected Behavior** - Cloud Sync Collection Mapping
    - **IMPORTANT**: Re-run the SAME tests from task 1 for bugs 1.4 and 1.5 - do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.4, 2.5_

  - [x] 6.4 Verify preservation tests still pass for cloud sync
    - **Property 2: Preservation** - Cloud Sync Regression Check
    - **IMPORTANT**: Re-run the SAME tests from task 2 for requirement 3.4 - do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 7. P1 Data Integrity: Fix `cloneItinerary` to clone pins for different users

  - [x] 7.1 Implement pin cloning in `cloneItinerary` in `usePlannerStore.ts`
    - Before inserting itinerary items, check if `sourceItinerary.user_id !== user.id`
    - If different user: extract unique pin IDs from source items, fetch those pins, insert cloned copies with `user_id: user.id` and new UUIDs, build a `Map<oldPinId, newPinId>`, then map `pin_id` in itinerary item rows to the new IDs
    - If same user: keep existing behavior (use original `pin_id` references directly)
    - _Bug_Condition: isBugCondition(sourceItinerary, user) where sourceItinerary.user_id !== user.id_
    - _Expected_Behavior: pins cloned into new user's account, itinerary items reference new pin IDs_
    - _Preservation: Same-user clone preserves day_number and sort_order unchanged (3.5)_
    - _Requirements: 1.6, 2.6, 3.5_

  - [x] 7.2 Verify bug condition exploration test now passes for cloneItinerary
    - **Property 1: Expected Behavior** - cloneItinerary Pin Cloning
    - **IMPORTANT**: Re-run the SAME test from task 1 for bug 1.6 - do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.6_

  - [x] 7.3 Verify preservation tests still pass for cloneItinerary
    - **Property 2: Preservation** - cloneItinerary Regression Check
    - **IMPORTANT**: Re-run the SAME tests from task 2 for requirement 3.5 - do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 8. P1 Performance/Security: Fix Distance Matrix API batching and rate limiting

  - [x] 8.1 Refactor `/api/distancematrix/route.ts` to use batched matrix call
    - Replace the N-1 sequential individual Google API calls with a single batched origins/destinations matrix request
    - Construct origins and destinations arrays from the N coordinates
    - Parse the matrix response to extract distance/duration segments
    - Maintain the same response shape (`DistanceSegment[]`) for backward compatibility
    - _Bug_Condition: isBugCondition(request) where request has N coordinates and N > 2_
    - _Expected_Behavior: single batched API call instead of N-1 sequential calls_
    - _Preservation: 2-coordinate requests continue returning single segment with same response shape (3.6)_
    - _Requirements: 1.7, 2.7, 3.6_

  - [x] 8.2 Add per-user rate limiting to the Distance Matrix endpoint
    - Implement rate limiting (e.g., using the existing `rateLimit` action or a similar mechanism) to prevent a single user from exhausting the API budget
    - Return 429 status when rate limit is exceeded
    - _Requirements: 1.7, 2.7_

- [x] 9. P1 UX: Fix MapView fly-to-arbitrary-pin on bulk hydration

  - [x] 9.1 Track newly-added pin IDs explicitly in `MapView.tsx`
    - Replace the `pins[currentCount - 1]` index-based approach with a diff of previous and current pin ID sets
    - Use a `useRef` to store the previous set of pin IDs
    - On each render, compute the diff to find genuinely new pins
    - Only fly to a pin if exactly one new pin was added (user action), skip fly on bulk hydration (multiple new pins)
    - _Bug_Condition: isBugCondition(pins) where multiple pins are added at once (e.g., cloud sync hydrates 30 pins)_
    - _Expected_Behavior: no fly animation on bulk hydration; fly only to single user-added pin_
    - _Preservation: Single user-added pin continues to trigger cinematic fly animation (3.7)_
    - _Requirements: 1.8, 2.8, 3.7_

  - [x] 9.2 Verify preservation tests still pass for MapView
    - **Property 2: Preservation** - MapView Fly Animation Regression Check
    - **IMPORTANT**: Re-run the SAME tests from task 2 for requirement 3.7 - do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 10. P2 Correctness: Fix VisualMarker DOM exception

  - [x] 10.1 Guard `removeChild` call in `VisualMarker.ts` `img.onerror` handler
    - Change `inner.removeChild(img)` to `if (img.parentNode === inner) { inner.removeChild(img); }`
    - This prevents DOM exception when error fires after element is already detached
    - _Bug_Condition: isBugCondition(event) where img.onerror fires after img is already detached from inner_
    - _Expected_Behavior: no DOM exception thrown; fallback icon shown if img is still attached_
    - _Preservation: Successful image loads continue displaying circular marker with hover animation (3.8)_
    - _Requirements: 1.9, 2.9, 3.8_

  - [x] 10.2 Verify bug condition exploration test now passes for VisualMarker
    - **Property 1: Expected Behavior** - VisualMarker Safe Detach
    - **IMPORTANT**: Re-run the SAME test from task 1 for bug 1.9 - do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.9_

  - [x] 10.3 Verify preservation tests still pass for VisualMarker
    - **Property 2: Preservation** - VisualMarker Regression Check
    - **IMPORTANT**: Re-run the SAME tests from task 2 for requirement 3.8 - do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 11. P2 Security: Add `'use server'` directive to `extractPlaces.ts`

  - [x] 11.1 Add `'use server'` directive at the top of `src/actions/extractPlaces.ts`
    - Insert `'use server';` as the first line of the file
    - This prevents client-side bundling of `@google/generative-ai` and `process.env` reads
    - _Bug_Condition: isBugCondition(file) where file lacks 'use server' directive_
    - _Expected_Behavior: file starts with 'use server' directive_
    - _Preservation: All exported functions (parseLLMResponse, buildExtractionPrompt, detectPlatform, etc.) continue returning identical results from server-side (3.9)_
    - _Requirements: 1.10, 2.10, 3.9_

  - [x] 11.2 Verify bug condition exploration test now passes for extractPlaces
    - **Property 1: Expected Behavior** - extractPlaces Server Directive
    - **IMPORTANT**: Re-run the SAME test from task 1 for bug 1.10 - do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.10_

  - [x] 11.3 Verify preservation tests still pass for extractPlaces
    - **Property 2: Preservation** - extractPlaces Regression Check
    - **IMPORTANT**: Re-run the SAME tests from task 2 for requirement 3.9 - do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 12. P2 Code Quality: Clean up MagicBar dead code

  - [x] 12.1 Remove unreachable `needs_input` clarification UI and dead state variables from `MagicBar.tsx`
    - Remove the unused `partialData`, `clarificationValue`, and `sourceUrl` state variables
    - Remove the unreachable `needs_input` UI branch since `processUrl` never sets these states
    - Keep all other MagicBar functionality intact (URL processing, pin creation, success animation)
    - _Bug_Condition: isBugCondition(component) where state variables are declared but never set by processUrl flow_
    - _Expected_Behavior: dead code removed; component is cleaner with no unreachable UI_
    - _Preservation: Valid URL processing with successful geocoding continues to create pins and show success animation (3.10)_
    - _Requirements: 1.11, 2.11, 3.10_

- [x] 13. P2 Schema: Add ON DELETE CASCADE to foreign keys

  - [x] 13.1 Create migration `0005_cascade_foreign_keys.sql`
    - Add `ON DELETE CASCADE` to `pins.user_id` FK (from `0001_initial_schema.sql`)
    - Add `ON DELETE CASCADE` to `collections.user_id` FK (from `0001_initial_schema.sql`)
    - Add `ON DELETE CASCADE` to `itinerary_items.pin_id` FK (from `0002_itinerary_planner.sql`)
    - Use `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ... ON DELETE CASCADE` pattern
    - _Bug_Condition: isBugCondition(schema) where FK constraints lack ON DELETE CASCADE_
    - _Expected_Behavior: user deletion cascades cleanly through pins, collections, and itinerary_items_
    - _Preservation: Existing RLS policies continue enforcing same SELECT/INSERT/UPDATE/DELETE rules (3.12)_
    - _Requirements: 1.13, 2.13, 3.12_

- [x] 14. P3 Operations: Gate production console.log calls

  - [x] 14.1 Gate `console.log` calls in `geocodeLocation.ts`, `scrapeUrl.ts`, and `middleware.ts`
    - Wrap each `console.log` call with `if (process.env.NODE_ENV !== 'production')` guard
    - Keep `console.error` calls unchanged (they are appropriate for production error logging)
    - _Requirements: 1.14, 2.14_

- [x] 15. P3 Infrastructure: Upgrade Node from 18 to 20 LTS

  - [x] 15.1 Update Dockerfile to use `node:20-alpine`
    - Replace all three `FROM node:18-alpine` lines (deps, builder, runner stages) with `FROM node:20-alpine`
    - _Requirements: 1.15, 2.15_

- [x] 16. Checkpoint - Ensure all tests pass
  - Re-run the full test suite to confirm all bug condition exploration tests pass and all preservation tests pass
  - Verify no regressions were introduced across the codebase
  - Ensure all tests pass, ask the user if questions arise
