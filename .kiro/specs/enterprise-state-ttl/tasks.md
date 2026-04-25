# Implementation Plan: Enterprise State TTL

## Overview

This plan implements two independent pillars: (1) TanStack Query integration to replace Zustand's server-state responsibilities with proper query/mutation hooks, and (2) a Supabase pg_cron migration for anonymous user TTL purging. Tasks are ordered so that foundational pieces (provider, hooks) land first, then the store refactor and component migration, and finally the SQL migration.

## Tasks

- [x] 1. Install TanStack Query and create QueryProvider
  - [x] 1.1 Install `@tanstack/react-query` and `@tanstack/react-query-devtools` packages
    - Run `npm install @tanstack/react-query @tanstack/react-query-devtools`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Create `src/components/QueryProvider.tsx` client component
    - Create a `'use client'` component that initialises a `QueryClient` inside `useState`
    - Configure defaults: `staleTime: 300_000`, `retry: 2`, `refetchOnWindowFocus: false`
    - Wrap children in `QueryClientProvider`
    - Include `ReactQueryDevtools` conditionally in development only
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 1.3 Wrap `src/app/layout.tsx` with QueryProvider
    - Import `QueryProvider` and wrap `{children}` inside it in the `RootLayout` component
    - _Requirements: 1.5_

- [x] 2. Implement itinerary query hooks
  - [x] 2.1 Create `src/hooks/useItineraryQueries.ts` with query key constants and `useItineraries` hook
    - Export `itineraryKeys` object with `all` and `detail(id)` helpers
    - Implement `useItineraries()` hook that fetches from `itineraries` table ordered by `created_at` desc
    - Map rows to the existing `Itinerary` type (snake_case → camelCase)
    - Use query key `['itineraries']`
    - Expose `data`, `isLoading`, `isError`, `error`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Add `useItineraryDetail(id)` hook to `src/hooks/useItineraryQueries.ts`
    - Fetch itinerary row + joined `itinerary_items` with `pins(*)` from Supabase
    - Hydrate into `Itinerary` and `Record<number, PlannedPin[]>` grouped by `day_number`
    - Use query key `['itinerary', id]`
    - Disable query when `id` is falsy (`enabled: !!id`)
    - Return `ItineraryDetailData` shape: `{ itinerary, dayItems }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 2.3 Write property test for itinerary row mapping (Property 1)
    - **Property 1: Itinerary row mapping preserves all fields**
    - Generate arbitrary Supabase row objects with `id`, `user_id`, `name`, `trip_date`, `created_at`
    - Assert mapped `Itinerary` fields match source with correct camelCase renaming
    - **Validates: Requirements 2.3**

  - [ ]* 2.4 Write property test for PlannedPin hydration grouping (Property 2)
    - **Property 2: PlannedPin hydration groups items by day_number**
    - Generate arbitrary arrays of itinerary item rows with pin data
    - Assert: every item appears exactly once, under the correct `day_number` key, total count matches input
    - **Validates: Requirements 3.3**

- [x] 3. Implement itinerary mutation hooks
  - [x] 3.1 Create `src/hooks/useItineraryMutations.ts` with create, delete, rename, clone mutation hooks
    - Each hook wraps `useMutation` and delegates to the corresponding server action
    - On success: invalidate `['itineraries']` query cache via `queryClient.invalidateQueries`
    - On error: call `useToastStore.getState().addToast(message, 'error')`
    - `useCreateItinerary` returns the created `Itinerary` from the action result
    - `useCloneItinerary` returns the cloned itinerary ID
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7_

  - [x] 3.2 Add `useSaveItinerary` mutation hook to `src/hooks/useItineraryMutations.ts`
    - Accept `itineraryId` and `items: SaveDayItem[]` as mutation variables
    - Delegate to `saveItineraryAction`
    - On success: invalidate `['itinerary', itineraryId]` query cache
    - On error: toast the error message
    - _Requirements: 4.5, 4.6, 4.7_

- [x] 4. Checkpoint — Verify hooks compile and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Refactor Zustand store to pure UI state
  - [x] 5.1 Refactor `src/store/usePlannerStore.ts` — remove server-state fields and actions
    - Remove `itineraries` array from state and `PlannerStore` interface
    - Remove `fetchItineraries` action
    - Remove `createItinerary`, `deleteItinerary`, `renameItinerary`, `cloneItinerary`, `loadItinerary`, `saveItinerary` actions
    - Remove Supabase client import and server action imports that are no longer needed
    - _Requirements: 5.1, 5.2, 5.7_

  - [x] 5.2 Add `setItineraryData` action to `src/store/usePlannerStore.ts`
    - Add action: `setItineraryData(itinerary: Itinerary, dayItems: Record<number, PlannedPin[]>)` that sets `activeItinerary`, `dayItems`, and resets `hasUnsavedChanges`
    - Retain `activeItinerary`, `dayItems`, `hasUnsavedChanges`, `isSaving`, `isLoadingItinerary` fields
    - Retain `addPinToDay`, `reorderPinInDay`, `movePinBetweenDays`, `removePinFromDay`, `addDay` actions
    - Update `reorderPinInDay` and `movePinBetweenDays` to remove their inline `saveItinerary` calls (save is now handled by mutation hooks at the component level)
    - _Requirements: 5.3, 5.4, 5.5, 5.6_

  - [ ]* 5.3 Write property test for addPinToDay (Property 3)
    - **Property 3: addPinToDay increases day pin count by exactly one**
    - Generate arbitrary `dayItems` state and a valid `Pin`
    - Assert: target day length increases by 1, all previous pins remain unchanged
    - **Validates: Requirements 5.6**

  - [ ]* 5.4 Write property test for reorderPinInDay (Property 4)
    - **Property 4: reorderPinInDay preserves the pin set**
    - Generate arbitrary day with ≥2 pins and valid index pair
    - Assert: same set of pin IDs, `sort_order` values are consecutive from 0
    - **Validates: Requirements 5.6**

  - [ ]* 5.5 Write property test for movePinBetweenDays (Property 5)
    - **Property 5: movePinBetweenDays preserves total pin count**
    - Generate arbitrary `dayItems` with source day having ≥1 pin
    - Assert: total pin count unchanged, moved pin in target day, absent from source day
    - **Validates: Requirements 5.6**

- [x] 6. Migrate ItineraryToolbar to TanStack Query hooks
  - [x] 6.1 Update `src/components/planner/ItineraryToolbar.tsx` to use query and mutation hooks
    - Replace `usePlannerStore((s) => s.itineraries)` with `useItineraries()` hook
    - Replace `createItinerary`, `deleteItinerary`, `renameItinerary` store calls with corresponding mutation hooks
    - Replace `saveItinerary` store call with `useSaveItinerary` mutation, reading `dayItems` from Zustand
    - Replace `loadItinerary` with `setItineraryData` from Zustand + `useItineraryDetail` data
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.2 Add loading and error states to ItineraryToolbar
    - Show a loading indicator (spinner or skeleton) when `useItineraries` `isLoading` is true
    - Show an error message when `useItineraries` `isError` is true
    - _Requirements: 6.4, 6.5_

  - [x] 6.3 Update `src/components/AppLayout.tsx` to remove `fetchItineraries` usage
    - Remove the `fetchItineraries` call from the `useEffect` in AppLayout
    - The itinerary list is now fetched automatically by `useItineraries` in ItineraryToolbar
    - _Requirements: 5.2, 6.1_

  - [x] 6.4 Update `src/components/PublicTripView.tsx` to use `useCloneItinerary` mutation hook
    - Replace `usePlannerStore.getState().cloneItinerary(...)` with the `useCloneItinerary` mutation
    - _Requirements: 4.4, 6.2_

- [x] 7. Checkpoint — Verify full TanStack Query integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create Supabase pg_cron TTL migration
  - [x] 8.1 Create `supabase/migrations/0006_anonymous_ttl.sql`
    - Enable `pg_cron` extension with `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog`
    - Create `purge_old_anonymous_users()` function as `SECURITY DEFINER`, `LANGUAGE sql`
    - Function deletes from `auth.users` where `is_anonymous = true` and `created_at < now() - interval '48 hours'`
    - Make cron scheduling idempotent: `SELECT cron.unschedule(...)` then `SELECT cron.schedule(...)`
    - Schedule hourly with cron expression `'0 * * * *'` and job name `'purge-old-anonymous-users'`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check` (already in devDependencies)
- The two pillars (TanStack Query and pg_cron TTL) are independently deployable — tasks 1–7 are client-side, task 8 is server-side SQL
