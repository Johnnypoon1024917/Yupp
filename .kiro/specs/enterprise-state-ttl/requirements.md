# Requirements Document

## Introduction

This feature delivers two architectural upgrades to the YUPP Travel planner application. First, TanStack Query (React Query) is introduced to decouple server-state management (data fetching, caching, background refetching) from client-side UI state managed by Zustand. Second, a Supabase pg_cron migration is added to enforce a 48-hour time-to-live (TTL) policy on anonymous user data, automatically purging stale rows and relying on ON DELETE CASCADE to clean up dependent tables.

## Glossary

- **Query_Provider**: A React context provider component that initialises and supplies a TanStack Query `QueryClient` instance to the component tree.
- **Query_Client**: The TanStack Query `QueryClient` object configured with default options (staleTime, retry, refetchOnWindowFocus).
- **Itinerary_Query_Hook**: A custom React hook (e.g., `useItineraries`) that wraps `useQuery` to fetch and cache the user's itinerary list from Supabase.
- **Itinerary_Detail_Hook**: A custom React hook (e.g., `useItineraryDetail`) that wraps `useQuery` to fetch and cache a single itinerary with its planned pins.
- **Itinerary_Mutation_Hooks**: Custom React hooks wrapping `useMutation` for create, delete, rename, clone, and save operations on itineraries, with automatic cache invalidation.
- **Planner_Store**: The Zustand store (`usePlannerStore`) that manages local UI state such as drag-and-drop ordering, active itinerary selection, day items, and unsaved-change tracking.
- **TTL_Purge_Function**: A PostgreSQL function (`purge_old_anonymous_users`) that deletes anonymous users whose `created_at` timestamp exceeds the configured retention period.
- **Cron_Schedule**: A pg_cron job that invokes the TTL_Purge_Function on a recurring interval.
- **Anonymous_User**: A Supabase auth user created via anonymous sign-in, identified by `is_anonymous = true` in `auth.users`.
- **Cascade_Delete**: The ON DELETE CASCADE foreign-key constraint behaviour that automatically removes child rows (pins, collections, itineraries, itinerary_items) when a parent user row is deleted.

## Requirements

### Requirement 1: TanStack Query Provider Setup

**User Story:** As a developer, I want a centralized TanStack Query provider wrapping the application, so that all components can access shared query caching and configuration.

#### Acceptance Criteria

1. THE Query_Provider SHALL initialise a Query_Client with a default staleTime of 300000 milliseconds (5 minutes).
2. THE Query_Provider SHALL configure the Query_Client with refetchOnWindowFocus set to false.
3. THE Query_Provider SHALL configure the Query_Client with a default retry count of 2.
4. THE Query_Provider SHALL be a client component (marked with `'use client'`).
5. WHEN the application layout renders, THE Root_Layout SHALL wrap its children with the Query_Provider.
6. THE Query_Provider SHALL render the ReactQueryDevtools component in development builds only.

### Requirement 2: Itinerary List Query Hook

**User Story:** As a developer, I want a dedicated query hook for fetching the itinerary list, so that itinerary data is cached, deduplicated, and automatically stale-managed by TanStack Query instead of Zustand.

#### Acceptance Criteria

1. THE Itinerary_Query_Hook SHALL fetch the itinerary list from the Supabase `itineraries` table ordered by `created_at` descending.
2. THE Itinerary_Query_Hook SHALL use a stable query key of `['itineraries']`.
3. THE Itinerary_Query_Hook SHALL map database rows to the existing `Itinerary` TypeScript type.
4. THE Itinerary_Query_Hook SHALL expose `data`, `isLoading`, `isError`, and `error` fields to consumers.
5. WHEN the query key `['itineraries']` is invalidated, THE Itinerary_Query_Hook SHALL automatically refetch the itinerary list.

### Requirement 3: Itinerary Detail Query Hook

**User Story:** As a developer, I want a query hook for loading a single itinerary with its planned pins, so that itinerary detail data benefits from TanStack Query caching and loading states.

#### Acceptance Criteria

1. WHEN an itinerary ID is provided, THE Itinerary_Detail_Hook SHALL fetch the itinerary row and its joined itinerary_items with pin data from Supabase.
2. THE Itinerary_Detail_Hook SHALL use a query key of `['itinerary', itineraryId]`.
3. THE Itinerary_Detail_Hook SHALL hydrate rows into the existing `Itinerary` and `PlannedPin` types, grouping planned pins by day_number into a `Record<number, PlannedPin[]>`.
4. WHEN no itinerary ID is provided, THE Itinerary_Detail_Hook SHALL disable the query (enabled: false).
5. THE Itinerary_Detail_Hook SHALL expose `data`, `isLoading`, `isError`, and `error` fields to consumers.

### Requirement 4: Itinerary Mutation Hooks

**User Story:** As a developer, I want mutation hooks for itinerary CRUD operations, so that server writes go through TanStack Query's mutation lifecycle with automatic cache invalidation.

#### Acceptance Criteria

1. WHEN a create-itinerary mutation succeeds, THE Itinerary_Mutation_Hooks SHALL invalidate the `['itineraries']` query cache.
2. WHEN a delete-itinerary mutation succeeds, THE Itinerary_Mutation_Hooks SHALL invalidate the `['itineraries']` query cache.
3. WHEN a rename-itinerary mutation succeeds, THE Itinerary_Mutation_Hooks SHALL invalidate the `['itineraries']` query cache.
4. WHEN a clone-itinerary mutation succeeds, THE Itinerary_Mutation_Hooks SHALL invalidate the `['itineraries']` query cache.
5. WHEN a save-itinerary mutation succeeds, THE Itinerary_Mutation_Hooks SHALL invalidate the `['itinerary', itineraryId]` query cache.
6. IF a mutation fails, THEN THE Itinerary_Mutation_Hooks SHALL display an error toast via the existing toast store.
7. THE Itinerary_Mutation_Hooks SHALL delegate all server writes to the existing server actions (createItineraryAction, deleteItineraryAction, renameItineraryAction, cloneItineraryAction, saveItineraryAction).

### Requirement 5: Zustand Store Refactor to Pure UI State

**User Story:** As a developer, I want the Zustand Planner_Store to manage only local UI state, so that server-state concerns are fully owned by TanStack Query and race conditions between the two are eliminated.

#### Acceptance Criteria

1. THE Planner_Store SHALL remove the `itineraries` array from its state.
2. THE Planner_Store SHALL remove the `fetchItineraries` action.
3. THE Planner_Store SHALL retain the `activeItinerary` field for tracking the currently selected itinerary.
4. THE Planner_Store SHALL retain the `dayItems` field for tracking drag-and-drop pin ordering.
5. THE Planner_Store SHALL retain the `hasUnsavedChanges` and `isSaving` flags.
6. THE Planner_Store SHALL retain all local mutation actions: addPinToDay, reorderPinInDay, movePinBetweenDays, removePinFromDay, and addDay.
7. THE Planner_Store SHALL remove the `createItinerary`, `deleteItinerary`, `renameItinerary`, `cloneItinerary`, `loadItinerary`, and `saveItinerary` actions that perform Supabase calls.

### Requirement 6: Component Migration to TanStack Query

**User Story:** As a developer, I want components like ItineraryToolbar to consume itinerary data from TanStack Query hooks, so that the UI reflects the cached server state without depending on Zustand for data fetching.

#### Acceptance Criteria

1. WHEN the ItineraryToolbar renders in list mode, THE ItineraryToolbar SHALL read the itinerary list from the Itinerary_Query_Hook instead of the Planner_Store.
2. WHEN the ItineraryToolbar triggers a create, delete, rename, or clone operation, THE ItineraryToolbar SHALL call the corresponding Itinerary_Mutation_Hook instead of a Planner_Store action.
3. WHEN the ItineraryToolbar triggers a save operation, THE ItineraryToolbar SHALL call the save mutation hook, reading dayItems from the Planner_Store.
4. WHEN the Itinerary_Query_Hook is in a loading state, THE ItineraryToolbar SHALL display a loading indicator instead of an empty list.
5. IF the Itinerary_Query_Hook returns an error, THEN THE ItineraryToolbar SHALL display an error message to the user.

### Requirement 7: Anonymous User TTL Purge Function

**User Story:** As an operator, I want anonymous user accounts older than 48 hours to be automatically deleted, so that the database does not accumulate stale anonymous data indefinitely.

#### Acceptance Criteria

1. THE TTL_Purge_Function SHALL delete rows from `auth.users` where `is_anonymous` is true and `created_at` is older than 48 hours relative to the current timestamp.
2. THE TTL_Purge_Function SHALL rely on existing ON DELETE CASCADE foreign-key constraints to remove dependent rows in pins, collections, itineraries, and itinerary_items tables.
3. THE TTL_Purge_Function SHALL be defined as a PostgreSQL function named `purge_old_anonymous_users` in the `public` schema.
4. IF no anonymous users meet the age threshold, THEN THE TTL_Purge_Function SHALL complete without error and delete zero rows.

### Requirement 8: pg_cron Scheduled Purge Job

**User Story:** As an operator, I want the anonymous user purge to run automatically on a recurring schedule, so that stale data is cleaned up without manual intervention.

#### Acceptance Criteria

1. THE Migration SHALL enable the `pg_cron` extension if it is not already enabled.
2. THE Cron_Schedule SHALL invoke the TTL_Purge_Function once every hour using the cron expression `'0 * * * *'`.
3. THE Cron_Schedule SHALL be registered with the job name `'purge-old-anonymous-users'`.
4. THE Migration SHALL be created as a Supabase migration file named `0006_anonymous_ttl.sql` in the `supabase/migrations/` directory.
5. THE Migration SHALL be idempotent — running the migration multiple times SHALL produce the same result without errors.
