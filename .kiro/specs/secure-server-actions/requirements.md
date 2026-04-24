# Requirements Document

## Introduction

The YUPP Travel application currently performs core database mutations (itinerary CRUD, pin updates, collection management) directly from client-side Zustand stores using the browser Supabase client. Authentication checks rely on client-side state (`if (!user || user.is_anonymous)`), which is trivially bypassable. This feature migrates all write-path database operations to Next.js Server Actions that validate the user session server-side via Supabase SSR cookies, explicitly reject anonymous users, and return structured results to the client.

## Glossary

- **Server_Action**: A Next.js `'use server'` function that executes on the server, receives arguments from the client, and returns a result. Server Actions have access to HTTP cookies and can validate sessions securely.
- **Auth_Guard**: A reusable server-side helper function (`requireRegisteredUser`) that validates the caller's session using Supabase SSR and throws an error if the user is unauthenticated or anonymous.
- **Supabase_SSR_Client**: The server-side Supabase client created via `@supabase/ssr` using HTTP-only cookies, as implemented in `src/utils/supabase/server.ts`.
- **Planner_Store**: The Zustand store (`usePlannerStore`) managing itinerary state on the client.
- **Pin_Store**: The Zustand store (`useTravelPinStore`) managing travel pins and collections on the client.
- **Anonymous_User**: A Supabase user whose `is_anonymous` property is `true`, created via anonymous sign-in for browsing without registration.
- **Registered_User**: A Supabase user who has completed email/OAuth sign-up and whose `is_anonymous` property is `false`.
- **Action_Result**: A discriminated union return type from Server Actions with shape `{ success: true; data: T }` or `{ success: false; error: string }`, enabling the client to handle outcomes without try/catch on thrown errors.
- **RLS**: Row Level Security — Supabase's PostgreSQL policies that restrict data access per user. Server Actions add an application-layer check before RLS is even reached.
- **Ownership_Scope**: A query filter pattern (`.eq('user_id', user.id)`) applied to UPDATE and DELETE operations to ensure a Registered_User can only modify their own records.

## Requirements

### Requirement 1: Server-Side Authentication Guard

**User Story:** As a backend engineer, I want a single reusable authentication helper for all Server Actions, so that session validation logic is consistent and cannot be bypassed from the client.

#### Acceptance Criteria

1. THE Auth_Guard SHALL accept a Supabase_SSR_Client instance and return the authenticated user object.
2. WHEN the Supabase_SSR_Client reports no active session, THE Auth_Guard SHALL throw an error with the message "Unauthorized: No user session found".
3. WHEN the Supabase_SSR_Client returns a user whose `is_anonymous` property is `true`, THE Auth_Guard SHALL throw an error with the message "Unauthorized: Anonymous users cannot perform this action".
4. WHEN the Supabase_SSR_Client returns a Registered_User, THE Auth_Guard SHALL return that user object without modification.
5. THE Auth_Guard SHALL call `supabase.auth.getUser()` (not `getSession()`) to validate the session against the Supabase auth server, preventing use of expired or tampered tokens.

### Requirement 2: Itinerary Server Actions

**User Story:** As a registered user, I want itinerary creation, deletion, and renaming to be validated on the server, so that anonymous users and unauthenticated requests cannot modify my trip data.

#### Acceptance Criteria

1. WHEN a Registered_User calls the create itinerary Server_Action with a name and optional trip date, THE Server_Action SHALL insert a new itinerary row with the user's ID and return the created itinerary as an Action_Result.
2. WHEN a Registered_User calls the delete itinerary Server_Action with an itinerary ID, THE Server_Action SHALL delete the itinerary using Ownership_Scope and return a success Action_Result.
3. WHEN a Registered_User calls the rename itinerary Server_Action with an itinerary ID and new name, THE Server_Action SHALL update the itinerary name using Ownership_Scope and return a success Action_Result.
4. WHEN an Anonymous_User or unauthenticated caller invokes any itinerary Server_Action, THE Auth_Guard SHALL reject the request before any database operation occurs.
5. IF a database error occurs during an itinerary Server_Action, THEN THE Server_Action SHALL return a failure Action_Result containing the error message.

### Requirement 3: Itinerary Save and Clone Server Actions

**User Story:** As a registered user, I want saving itinerary items and cloning public trips to be secured on the server, so that the bulk-write operations that manage my day-by-day plans cannot be forged from the client.

#### Acceptance Criteria

1. WHEN a Registered_User calls the save itinerary Server_Action with an itinerary ID and an array of day items, THE Server_Action SHALL delete existing itinerary items for that itinerary using Ownership_Scope and insert the new items, returning a success Action_Result.
2. WHEN a Registered_User calls the clone itinerary Server_Action with a source itinerary ID, THE Server_Action SHALL create a new itinerary owned by the caller and copy all itinerary items from the source, returning the new itinerary ID as an Action_Result.
3. WHEN an Anonymous_User or unauthenticated caller invokes the save or clone Server_Action, THE Auth_Guard SHALL reject the request before any database operation occurs.
4. IF the source itinerary does not exist during a clone operation, THEN THE Server_Action SHALL return a failure Action_Result with a descriptive error.

### Requirement 4: Input Validation on Server Actions

**User Story:** As a backend engineer, I want all Server Action inputs to be validated on the server, so that malformed or malicious data is rejected before reaching the database.

#### Acceptance Criteria

1. WHEN the create itinerary Server_Action receives a name that is empty or exceeds 200 characters, THE Server_Action SHALL return a failure Action_Result with a validation error message.
2. WHEN the rename itinerary Server_Action receives a new name that is empty or exceeds 200 characters, THE Server_Action SHALL return a failure Action_Result with a validation error message.
3. WHEN any Server_Action receives an itinerary ID that is not a valid UUID format, THE Server_Action SHALL return a failure Action_Result with a validation error message.
4. WHEN the create itinerary Server_Action receives a trip date, THE Server_Action SHALL validate that the trip date is a valid ISO 8601 date string before inserting.
5. WHEN the save itinerary Server_Action receives day items, THE Server_Action SHALL validate that each item contains a valid pin ID (UUID) and a non-negative integer day number.

### Requirement 5: Zustand Store Migration for Itineraries

**User Story:** As a frontend developer, I want the Planner_Store to call Server Actions instead of using the browser Supabase client directly, so that all mutations flow through the secure server-side path.

#### Acceptance Criteria

1. THE Planner_Store `createItinerary` method SHALL call the create itinerary Server_Action and update local state from the Action_Result.
2. THE Planner_Store `deleteItinerary` method SHALL call the delete itinerary Server_Action and update local state only on a success Action_Result.
3. THE Planner_Store `renameItinerary` method SHALL call the rename itinerary Server_Action and update local state only on a success Action_Result.
4. THE Planner_Store `saveItinerary` method SHALL call the save itinerary Server_Action and update local state only on a success Action_Result.
5. THE Planner_Store `cloneItinerary` method SHALL call the clone itinerary Server_Action and load the cloned itinerary only on a success Action_Result.
6. THE Planner_Store SHALL remove all direct imports of `@/utils/supabase/client` used for mutation operations.
7. WHEN a Server_Action returns a failure Action_Result, THE Planner_Store SHALL display the error message using the Toast_Store.

### Requirement 6: Structured Error Handling Pattern

**User Story:** As a frontend developer, I want Server Actions to return structured results instead of throwing errors, so that the client can handle success and failure cases predictably without try/catch blocks.

#### Acceptance Criteria

1. THE Action_Result type SHALL be a discriminated union with a `success` boolean field, a `data` field on success, and an `error` string field on failure.
2. WHEN a Server_Action completes successfully, THE Server_Action SHALL return `{ success: true, data: <result> }`.
3. WHEN a Server_Action encounters an authentication error, THE Server_Action SHALL return `{ success: false, error: <auth_error_message> }`.
4. WHEN a Server_Action encounters a validation error, THE Server_Action SHALL return `{ success: false, error: <validation_error_message> }`.
5. WHEN a Server_Action encounters a database error, THE Server_Action SHALL return `{ success: false, error: <database_error_message> }`.
6. THE Server_Action SHALL catch all exceptions internally and return a failure Action_Result, preventing unhandled errors from propagating to the client.

### Requirement 7: Future Expansion — Pin and Collection Server Actions

**User Story:** As a backend engineer, I want the Server Action architecture to be extensible to pin and collection mutations, so that the same security pattern can be applied to all write operations in the application.

#### Acceptance Criteria

1. THE Auth_Guard SHALL be exported from a shared module (`src/actions/auth.ts`) so that future Server Action files for pins and collections can import and reuse the same authentication logic.
2. THE Action_Result type SHALL be exported from the shared types module (`src/types/index.ts`) so that all Server Action files use a consistent return type.
3. WHEN pin mutation Server Actions are created in the future, THE Pin_Store fire-and-forget Supabase calls SHALL be replaceable with Server_Action calls following the same pattern established for itineraries.
4. THE itinerary Server Actions file (`src/actions/itineraryActions.ts`) SHALL serve as the reference implementation for the pattern: Auth_Guard → input validation → database operation → Action_Result return.
