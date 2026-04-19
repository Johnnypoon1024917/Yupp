# Requirements Document

## Introduction

The Supabase Cloud Bridge feature upgrades the YUPP travel pin board application from a purely local-storage-based architecture to a hybrid local/cloud model powered by Supabase. The feature introduces a PostgreSQL database schema with Row-Level Security, SSR-compatible Supabase authentication, an OAuth-based login UI, Zustand store extensions for cloud-aware state, and a guest-to-cloud sync engine that migrates local data to Supabase upon first sign-in. The application must remain fully functional for unauthenticated guest users who continue to use localStorage.

## Glossary

- **Cloud_Bridge**: The overall system responsible for connecting the local Zustand store to the remote Supabase database, encompassing authentication, data migration, and ongoing cloud persistence.
- **Database_Schema**: The Supabase PostgreSQL migration that defines the `collections` and `pins` tables along with their columns, constraints, and foreign keys.
- **RLS_Policy**: A Row-Level Security policy applied to a Supabase table that restricts row access based on the authenticated user's identity (`auth.uid()`).
- **Browser_Client**: The Supabase client instantiated in browser-side code via `@supabase/ssr`, used for client-side queries and auth operations.
- **Server_Client**: The Supabase client instantiated in server-side code (Server Components, Route Handlers) via `@supabase/ssr` with cookie-based session management.
- **Auth_Middleware**: The Next.js middleware (`src/middleware.ts`) responsible for refreshing Supabase auth tokens on incoming server requests without blocking unauthenticated guest access.
- **Auth_Modal**: The UI component (`src/components/AuthModal.tsx`) that presents OAuth login options to the user in a glassmorphic drawer or modal.
- **Travel_Pin_Store**: The Zustand store (`src/store/useTravelPinStore.ts`) that manages pins, collections, and application UI state, persisted to localStorage.
- **Sync_Engine**: The hook (`src/hooks/useCloudSync.ts`) that listens for auth state changes and orchestrates the migration of local guest data to Supabase and the hydration of cloud data into the store.
- **Guest_User**: An unauthenticated user whose data exists only in localStorage via the Travel_Pin_Store.
- **Cloud_User**: An authenticated user whose data is persisted in the Supabase database.
- **Local_Data**: Pins and collections stored in localStorage that do not have a `user_id` field set.

## Requirements

### Requirement 1: Database Schema Migration

**User Story:** As a developer, I want a Supabase migration that creates the `collections` and `pins` tables with correct columns, types, and foreign keys, so that cloud user data has a well-defined relational schema.

#### Acceptance Criteria

1. THE Database_Schema SHALL define a `collections` table with columns: `id` (UUID, primary key, default `gen_random_uuid()`), `user_id` (UUID, NOT NULL, references `auth.users`), `name` (TEXT, NOT NULL), `is_public` (BOOLEAN, default false), and `created_at` (TIMESTAMPTZ, default `now()`).
2. THE Database_Schema SHALL define a `pins` table with columns: `id` (UUID, primary key, default `gen_random_uuid()`), `user_id` (UUID, NOT NULL, references `auth.users`), `collection_id` (UUID, NOT NULL, references `collections.id`), `title` (TEXT, NOT NULL), `image_url` (TEXT, NOT NULL), `source_url` (TEXT, NOT NULL), `latitude` (FLOAT, NOT NULL), `longitude` (FLOAT, NOT NULL), `place_id` (TEXT, nullable), `primary_type` (TEXT, nullable), `rating` (FLOAT, nullable), and `created_at` (TIMESTAMPTZ, default `now()`).
3. THE Database_Schema SHALL place the migration file at `supabase/migrations/0001_initial_schema.sql`.

### Requirement 2: Row-Level Security Policies

**User Story:** As a developer, I want RLS policies on the `collections` and `pins` tables, so that each authenticated user can only access their own data.

#### Acceptance Criteria

1. THE Database_Schema SHALL enable Row-Level Security on the `collections` table.
2. THE Database_Schema SHALL enable Row-Level Security on the `pins` table.
3. THE RLS_Policy SHALL permit SELECT operations on the `collections` table only for rows where `user_id` equals `auth.uid()`.
4. THE RLS_Policy SHALL permit INSERT operations on the `collections` table only for rows where `user_id` equals `auth.uid()`.
5. THE RLS_Policy SHALL permit UPDATE operations on the `collections` table only for rows where `user_id` equals `auth.uid()`.
6. THE RLS_Policy SHALL permit DELETE operations on the `collections` table only for rows where `user_id` equals `auth.uid()`.
7. THE RLS_Policy SHALL permit SELECT operations on the `pins` table only for rows where `user_id` equals `auth.uid()`.
8. THE RLS_Policy SHALL permit INSERT operations on the `pins` table only for rows where `user_id` equals `auth.uid()`.
9. THE RLS_Policy SHALL permit UPDATE operations on the `pins` table only for rows where `user_id` equals `auth.uid()`.
10. THE RLS_Policy SHALL permit DELETE operations on the `pins` table only for rows where `user_id` equals `auth.uid()`.

### Requirement 3: Supabase Browser Client

**User Story:** As a developer, I want a browser-side Supabase client utility, so that client components can perform authenticated queries and auth operations.

#### Acceptance Criteria

1. THE Browser_Client SHALL be exported from `src/utils/supabase/client.ts`.
2. THE Browser_Client SHALL be created using `createBrowserClient` from `@supabase/ssr`.
3. THE Browser_Client SHALL read the Supabase project URL from the `NEXT_PUBLIC_SUPABASE_URL` environment variable.
4. THE Browser_Client SHALL read the Supabase anonymous key from the `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variable.

### Requirement 4: Supabase Server Client

**User Story:** As a developer, I want a server-side Supabase client utility with cookie-based session management, so that Server Components and Route Handlers can perform authenticated queries.

#### Acceptance Criteria

1. THE Server_Client SHALL be exported from `src/utils/supabase/server.ts`.
2. THE Server_Client SHALL be created using `createServerClient` from `@supabase/ssr`.
3. THE Server_Client SHALL read the Supabase project URL from the `NEXT_PUBLIC_SUPABASE_URL` environment variable.
4. THE Server_Client SHALL read the Supabase anonymous key from the `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variable.
5. THE Server_Client SHALL use the Next.js `cookies()` API to get and set auth session cookies.

### Requirement 5: Auth Token Refresh Middleware

**User Story:** As a developer, I want Next.js middleware that refreshes Supabase auth tokens on server requests, so that authenticated sessions remain valid across navigation without blocking guest access.

#### Acceptance Criteria

1. THE Auth_Middleware SHALL be defined in `src/middleware.ts`.
2. WHEN a server request is received, THE Auth_Middleware SHALL refresh the Supabase auth session by calling `supabase.auth.getUser()`.
3. THE Auth_Middleware SHALL update the response cookies with the refreshed session tokens.
4. THE Auth_Middleware SHALL allow all requests to proceed regardless of authentication status, so that Guest_Users can use the application without restriction.
5. THE Auth_Middleware SHALL export a `config.matcher` that excludes static assets, image optimization routes, and the favicon from middleware processing.

### Requirement 6: Authentication Modal UI

**User Story:** As a user, I want a visually polished login modal that appears when I tap the Profile icon, so that I can sign in with my Google account.

#### Acceptance Criteria

1. THE Auth_Modal SHALL be implemented in `src/components/AuthModal.tsx`.
2. THE Auth_Modal SHALL use the `vaul` Drawer component or a Framer Motion modal for presentation.
3. THE Auth_Modal SHALL apply glassmorphic styling with classes `backdrop-blur-md bg-surface/90 rounded-3xl`.
4. WHEN the user taps the "Sign in with Google" button, THE Auth_Modal SHALL call `supabase.auth.signInWithOAuth({ provider: 'google' })`.
5. WHEN the user taps the Profile icon in the BottomNav component, THE Auth_Modal SHALL open.
6. WHILE the user is already authenticated, THE Auth_Modal SHALL display the user's identity information and a sign-out option instead of the sign-in button.
7. WHEN the user taps the sign-out option, THE Auth_Modal SHALL call `supabase.auth.signOut()` and clear the user from the Travel_Pin_Store.

### Requirement 7: Zustand Store Cloud Extensions

**User Story:** As a developer, I want the Pin and Collection interfaces and the Zustand store to support an optional `user_id` field and cloud-aware state, so that the store can distinguish between local guest data and cloud user data.

#### Acceptance Criteria

1. THE Travel_Pin_Store SHALL add an optional `user_id` field of type `string` to the Pin interface in `src/types/index.ts`.
2. THE Travel_Pin_Store SHALL add an optional `user_id` field of type `string` to the Collection interface in `src/types/index.ts`.
3. THE Travel_Pin_Store SHALL add a `user` state field that holds the authenticated Supabase user object or null.
4. THE Travel_Pin_Store SHALL add a `setUser` action that updates the `user` state field.
5. THE Travel_Pin_Store SHALL add a `setCloudData` action that replaces the current pins and collections with cloud-fetched data.
6. THE Travel_Pin_Store SHALL continue to persist pins and collections to localStorage so that Guest_Users retain offline functionality.

### Requirement 8: Guest-to-Cloud Sync on Sign-In

**User Story:** As a guest user who signs in for the first time, I want my locally saved pins and collections to be migrated to the cloud, so that I do not lose any data I created before authenticating.

#### Acceptance Criteria

1. THE Sync_Engine SHALL be implemented in `src/hooks/useCloudSync.ts`.
2. THE Sync_Engine SHALL subscribe to `supabase.auth.onAuthStateChange` to detect authentication events.
3. WHEN a SIGNED_IN event is detected, THE Sync_Engine SHALL identify Local_Data (pins and collections without a `user_id`) in the Travel_Pin_Store.
4. WHEN Local_Data exists, THE Sync_Engine SHALL batch INSERT the local collections into the Supabase `collections` table with the authenticated user's `user_id`.
5. WHEN Local_Data exists, THE Sync_Engine SHALL batch INSERT the local pins into the Supabase `pins` table with the authenticated user's `user_id` and the corresponding cloud `collection_id`.
6. WHEN the batch INSERT operations complete, THE Sync_Engine SHALL fetch all cloud data for the authenticated user from Supabase.
7. WHEN cloud data is fetched, THE Sync_Engine SHALL call `setCloudData` on the Travel_Pin_Store to hydrate the store with the cloud data.
8. WHILE the sync operation is in progress, THE Sync_Engine SHALL allow the UI to remain interactive and non-blocking.
9. WHEN the sync operation completes successfully, THE Sync_Engine SHALL display a success toast notification to the user.
10. IF the batch INSERT operation fails, THEN THE Sync_Engine SHALL display an error toast notification and retain the Local_Data in the Travel_Pin_Store so that no data is lost.

### Requirement 9: Collection ID Mapping During Migration

**User Story:** As a developer, I want the sync engine to correctly map local collection IDs to their new cloud UUIDs when migrating pins, so that pin-to-collection relationships are preserved after migration.

#### Acceptance Criteria

1. WHEN migrating Local_Data, THE Sync_Engine SHALL create a mapping from each local collection `id` to the corresponding cloud-generated collection `id` returned by the Supabase INSERT.
2. WHEN inserting local pins into Supabase, THE Sync_Engine SHALL replace each pin's local `collectionId` with the mapped cloud collection `id`.
3. IF a local pin references a `collectionId` that has no corresponding cloud collection, THEN THE Sync_Engine SHALL assign the pin to a default "unorganized" cloud collection for the authenticated user.

### Requirement 10: Auth State Persistence Across Navigation

**User Story:** As an authenticated user, I want my session to persist across page navigations and refreshes, so that I do not need to re-authenticate on every visit.

#### Acceptance Criteria

1. WHEN the application loads, THE Sync_Engine SHALL check for an existing Supabase session and call `setUser` on the Travel_Pin_Store if a session exists.
2. WHEN a SIGNED_OUT event is detected, THE Sync_Engine SHALL call `setUser(null)` on the Travel_Pin_Store and revert the store to local-only mode.
3. THE Auth_Middleware SHALL ensure that server-rendered pages have access to the current auth session via refreshed cookies.

### Requirement 11: Environment Variable Configuration

**User Story:** As a developer, I want clear environment variable requirements, so that the Supabase connection is configured correctly in all environments.

#### Acceptance Criteria

1. THE Cloud_Bridge SHALL require the `NEXT_PUBLIC_SUPABASE_URL` environment variable to be set with the Supabase project URL.
2. THE Cloud_Bridge SHALL require the `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variable to be set with the Supabase anonymous API key.
3. IF `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is not set, THEN THE Browser_Client and Server_Client SHALL fail with a descriptive error message indicating the missing variable.
