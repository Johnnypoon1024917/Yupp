# Bugfix Requirements Document

## Introduction

A comprehensive production audit identified multiple bugs across the travel-pin-board application spanning security vulnerabilities, data integrity issues, dead code, and correctness problems. This document captures the bug conditions, expected fixes, and preservation requirements for all confirmed issues organized by severity (P0 through P3). Items that reference non-existent code (admin pages, validateUUID) are excluded as they are future concerns, not current bugs.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN viewing `.env.local.example` THEN the system exposes a real Google API key (`AIzaSyDv99fpuGYfovsEsWQub4Rk_S9PS-8_XTY`) on line 22 as a bare string outside any variable assignment, leaking credentials to any public repo clone

1.2 WHEN an authenticated user calls `removePin(pinId)` in `useTravelPinStore` THEN the system only filters the pin from local state and never issues a Supabase delete, leaving the pin permanently in the cloud database

1.3 WHEN an authenticated user calls `removePinFromDay(dayNumber, pinId)` in `usePlannerStore` THEN the system does not set `hasUnsavedChanges = true`, so the deletion is silently lost if the user navigates away without a manual save

1.4 WHEN `buildCollectionIdMap` in `useCloudSync.ts` pairs local collections with cloud collections THEN the system uses index-based mapping (`localCollections[i] → cloudCollections[i]`), but Postgres `INSERT ... RETURNING` does not guarantee row order matches input order, causing pins to be remapped to wrong collections on first sync

1.5 WHEN the live-sync store subscriber in `useCloudSync.ts` (lines 316-371) pushes newly-added pins to Supabase THEN the system hardcodes `collection_id: unorganizedCloudId` regardless of which collection the pin was actually created in, breaking auto-categorization for signed-in users

1.6 WHEN `cloneItinerary` in `usePlannerStore` clones an itinerary for a different user THEN the system copies `pin_id` references directly from the source user's itinerary items without cloning the underlying pins into the new user's account, causing FK/RLS failures and invisible pins on subsequent renders

1.7 WHEN the Distance Matrix API endpoint (`/api/distancematrix/route.ts`) receives a request with N coordinates THEN the system makes N-1 sequential individual Google API calls instead of using the batched origins/destinations matrix, and has no per-user rate limiting, allowing a single user to drain the API budget

1.8 WHEN `MapView.tsx` detects new pins via the `useEffect` at lines 360-371 THEN the system flies to `pins[currentCount - 1]` (the last pin by array index) on every count increase, so when cloud sync hydrates 30 pins at once the map flies to an arbitrary pin unrelated to user intent

1.9 WHEN `VisualMarker.ts` image loading fails and the `img.onerror` handler fires THEN the system calls `inner.removeChild(img)` without checking if `img` is still a child of `inner`, which throws a DOM exception if the error fires after the element was already detached

1.10 WHEN `extractPlaces.ts` is imported THEN the file lacks a `'use server'` directive, so if it is ever imported from a client component the bundler will pull `@google/generative-ai` and `process.env` reads into the client bundle, leaking API keys

1.11 WHEN the MagicBar component mounts THEN the state variables `partialData`, `clarificationValue`, and `sourceUrl` are declared but never set by the main `processUrl` flow, making the entire `needs_input` clarification UI unreachable dead code

1.12 WHEN cloning the repository THEN the committed `travel-pin-board.tar` (56 MB) bloats every clone unnecessarily

1.13 WHEN the foreign key constraints on `pins`, `collections`, `itineraries`, and `itinerary_items` are examined THEN the `user_id` FK on `pins` and `collections` (in `0001_initial_schema.sql`) and the `pin_id` FK on `itinerary_items` (in `0002_itinerary_planner.sql`) lack `ON DELETE CASCADE`, so any future anonymous user purge migration would fail with FK violations

1.14 WHEN `console.log` calls in `geocodeLocation.ts`, `scrapeUrl.ts`, and `middleware.ts` execute in production THEN the system leaks internal debugging information to production logs without level gating

1.15 WHEN the Dockerfile and `tailwind.config.ts` are examined THEN the system uses Node 18 which is EOL (End of Life)

### Expected Behavior (Correct)

2.1 WHEN viewing `.env.local.example` THEN the system SHALL contain only placeholder values (e.g., `your_google_api_key_here`) with no real API keys, and the leaked key SHALL be rotated in GCP and scrubbed from git history

2.2 WHEN an authenticated user calls `removePin(pinId)` THEN the system SHALL delete the pin from local state AND issue a fire-and-forget Supabase delete (`supabase.from('pins').delete().eq('id', pinId)`) consistent with the existing pattern used by `updatePin` and `renameCollection`

2.3 WHEN an authenticated user calls `removePinFromDay(dayNumber, pinId)` THEN the system SHALL set `hasUnsavedChanges = true` in the returned state so the unsaved-changes guard prevents silent data loss on navigation

2.4 WHEN `buildCollectionIdMap` pairs local collections with cloud collections THEN the system SHALL match by collection name (or a client-generated reference) rather than by array index, ensuring correct mapping regardless of Postgres return order

2.5 WHEN the live-sync store subscriber pushes newly-added pins to Supabase THEN the system SHALL use each pin's actual `collectionId` (resolved through the collection ID map) instead of hardcoding `unorganizedCloudId`

2.6 WHEN `cloneItinerary` clones an itinerary for a different user THEN the system SHALL first clone the referenced pins into the new user's account, then map the original `pin_id` values to the newly-created pin IDs before inserting itinerary items

2.7 WHEN the Distance Matrix API endpoint receives a request with N coordinates THEN the system SHALL use Google's batched origins/destinations matrix in a single API call, and SHALL enforce per-user rate limiting to prevent budget exhaustion

2.8 WHEN `MapView.tsx` detects new pins THEN the system SHALL track newly-added pin IDs explicitly (e.g., via a diff of previous and current pin ID sets) and fly to the most recently user-added pin, not an arbitrary array index

2.9 WHEN `VisualMarker.ts` image error handler fires THEN the system SHALL guard the `removeChild` call with `if (img.parentNode === inner)` before attempting removal

2.10 WHEN `extractPlaces.ts` is loaded THEN the file SHALL include a `'use server'` directive at the top to prevent client-side bundling of server-only dependencies and environment variables

2.11 WHEN the MagicBar component's `processUrl` flow encounters a `needs_user_input` geocode result THEN the system SHALL set `partialData`, `sourceUrl`, and transition to the `needs_input` state so the clarification UI is reachable, OR the dead state/UI code SHALL be removed if the feature is intentionally deferred

2.12 WHEN cloning the repository THEN `travel-pin-board.tar` SHALL NOT be present in the tracked files; it SHALL be added to `.gitignore` and removed from git history

2.13 WHEN the database schema defines foreign keys for `pins.user_id`, `collections.user_id`, and `itinerary_items.pin_id` THEN a new migration (`0005_cascade_foreign_keys.sql`) SHALL alter these constraints to include `ON DELETE CASCADE` so that user deletion cascades cleanly

2.14 WHEN the application runs in production THEN `console.log` calls in `geocodeLocation.ts`, `scrapeUrl.ts`, and `middleware.ts` SHALL be gated behind `process.env.NODE_ENV !== 'production'` or replaced with a leveled logger

2.15 WHEN the Dockerfile and build tooling are examined THEN the system SHALL use Node 20 (LTS) instead of the EOL Node 18

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an unauthenticated (local-only) user calls `removePin` THEN the system SHALL CONTINUE TO filter the pin from local state without attempting any Supabase call

3.2 WHEN `addPin`, `updatePin`, `renameCollection`, and other existing store mutations are called THEN the system SHALL CONTINUE TO perform their current local state updates and fire-and-forget Supabase persistence pattern unchanged

3.3 WHEN `addPinToDay`, `reorderPinInDay`, and `movePinBetweenDays` are called THEN the system SHALL CONTINUE TO set `hasUnsavedChanges = true` as they currently do

3.4 WHEN cloud sync pushes local data for users with no custom collections (only "Unorganized") THEN the system SHALL CONTINUE TO correctly map the default collection to the cloud Unorganized collection

3.5 WHEN `cloneItinerary` clones an itinerary owned by the same user THEN the system SHALL CONTINUE TO preserve day_number and sort_order for all itinerary items

3.6 WHEN the Distance Matrix endpoint receives a valid request with 2 coordinates THEN the system SHALL CONTINUE TO return a single distance/duration segment with the same response shape

3.7 WHEN a single pin is added by the user via MagicBar THEN the system SHALL CONTINUE TO fly the map camera to that pin's coordinates with the cinematic pitch animation

3.8 WHEN a VisualMarker image loads successfully THEN the system SHALL CONTINUE TO display the pin image in the circular marker element with hover animation

3.9 WHEN `extractPlaces.ts` functions (`parseLLMResponse`, `buildExtractionPrompt`, `detectPlatform`, etc.) are called from server-side code THEN the system SHALL CONTINUE TO return identical results

3.10 WHEN the MagicBar processes a valid URL with successful geocoding THEN the system SHALL CONTINUE TO create pins and show the success status animation

3.11 WHEN existing environment variables in `.env.local.example` are read THEN the system SHALL CONTINUE TO provide the same placeholder variable names and documentation structure

3.12 WHEN existing RLS policies on `pins`, `collections`, `itineraries`, and `itinerary_items` are evaluated THEN the system SHALL CONTINUE TO enforce the same SELECT/INSERT/UPDATE/DELETE rules for authenticated users