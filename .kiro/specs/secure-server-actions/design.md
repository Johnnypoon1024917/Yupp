# Design Document

## Overview

This design migrates database mutation operations from client-side Zustand stores to secure Next.js Server Actions. The architecture introduces a shared authentication guard, structured return types, input validation, and a clear separation between server-side data operations and client-side state management.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│  Client (Browser)                                       │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │  usePlannerStore  │───▶│  Server Action   │──────┐   │
│  │  (Zustand)        │◀───│  Calls           │      │   │
│  └──────────────────┘    └──────────────────┘      │   │
│  ┌──────────────────┐                               │   │
│  │  useToastStore    │◀── error display             │   │
│  └──────────────────┘                               │   │
└─────────────────────────────────────────────────────┼───┘
                                                      │
                          HTTP (cookies)              │
                                                      ▼
┌─────────────────────────────────────────────────────────┐
│  Server (Next.js Server Actions)                        │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │  src/actions/     │    │  src/actions/     │          │
│  │  auth.ts          │    │  itineraryActions │          │
│  │  (Auth_Guard)     │◀───│  .ts              │          │
│  └──────────────────┘    └────────┬─────────┘          │
│                                    │                    │
│  ┌──────────────────┐             │                    │
│  │  Input Validation │◀────────────┘                    │
│  │  (per action)     │                                  │
│  └────────┬─────────┘                                  │
│           │                                             │
│           ▼                                             │
│  ┌──────────────────┐                                  │
│  │  Supabase SSR     │                                  │
│  │  Client (cookies) │                                  │
│  └────────┬─────────┘                                  │
│           │                                             │
│           ▼                                             │
│  ┌──────────────────┐                                  │
│  │  PostgreSQL + RLS │                                  │
│  └──────────────────┘                                  │
└─────────────────────────────────────────────────────────┘
```

### Request Flow

1. Client Zustand store method is called (e.g., `createItinerary`)
2. Store calls the corresponding Server Action (e.g., `createItineraryAction`)
3. Server Action creates Supabase SSR client from cookies
4. Auth_Guard validates session via `getUser()` and rejects anonymous users
5. Input validation checks arguments (name length, UUID format, etc.)
6. Database operation executes with ownership-scoped queries
7. Server Action returns `ActionResult<T>` (never throws)
8. Store updates local state on success, shows toast on failure

## File Structure

```
src/
├── actions/
│   ├── auth.ts                    # NEW — Auth_Guard (requireRegisteredUser)
│   └── itineraryActions.ts        # NEW — Itinerary CRUD Server Actions
├── store/
│   └── usePlannerStore.ts         # MODIFIED — calls Server Actions instead of client Supabase
└── types/
    └── index.ts                   # MODIFIED — adds ActionResult type
```

## Detailed Design

### 1. ActionResult Type (`src/types/index.ts`)

Add a generic discriminated union type for all Server Action returns:

```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
```

This replaces thrown errors with predictable return values. The generic parameter `T` defaults to `void` for actions that don't return data (delete, rename, save).

### 2. Auth Guard (`src/actions/auth.ts`)

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function requireRegisteredUser(
  supabase: SupabaseClient
): Promise<User> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Unauthorized: No user session found');
  }
  if (user.is_anonymous) {
    throw new Error('Unauthorized: Anonymous users cannot perform this action');
  }
  return user;
}
```

Key decisions:
- Accepts a `SupabaseClient` parameter rather than creating its own — the calling Server Action creates the client once and passes it through. This avoids double cookie reads and makes the guard testable with mocks.
- Throws errors (not ActionResult) because the calling Server Action catches all exceptions and wraps them in ActionResult. This keeps the guard simple and composable.
- Uses `getUser()` which validates the JWT against the Supabase auth server, unlike `getSession()` which only reads the local token.

### 3. Input Validation Helpers (`src/actions/itineraryActions.ts`)

Inline validation functions within the actions file:

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 200;

function validateName(name: unknown): string {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Name is required and cannot be empty');
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Name cannot exceed ${MAX_NAME_LENGTH} characters`);
  }
  return name.trim();
}

function validateUUID(id: unknown): string {
  if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
    throw new Error('Invalid ID format');
  }
  return id;
}

function validateTripDate(date: unknown): string | null {
  if (date === undefined || date === null) return null;
  if (typeof date !== 'string') throw new Error('Trip date must be a string');
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) throw new Error('Trip date is not a valid date');
  return date;
}
```

These throw errors that the wrapping Server Action catches and converts to `ActionResult`.

### 4. Itinerary Server Actions (`src/actions/itineraryActions.ts`)

Each action follows the pattern: create client → auth guard → validate → DB operation → return ActionResult.

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import { requireRegisteredUser } from '@/actions/auth';
import type { ActionResult } from '@/types';
import type { Itinerary } from '@/types';

export async function createItineraryAction(
  name: string,
  tripDate?: string
): Promise<ActionResult<Itinerary>> {
  try {
    const supabase = await createClient();
    const user = await requireRegisteredUser(supabase);
    const validName = validateName(name);
    const validDate = validateTripDate(tripDate);

    const { data, error } = await supabase
      .from('itineraries')
      .insert({ user_id: user.id, name: validName, trip_date: validDate })
      .select()
      .single();

    if (error) return { success: false, error: `Failed to create itinerary: ${error.message}` };

    return {
      success: true,
      data: {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        tripDate: data.trip_date,
        createdAt: data.created_at,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
```

Delete, rename, save, and clone actions follow the same structure. The save action accepts a serializable day items payload (array of `{ pinId, dayNumber, sortOrder }`), not the full PlannedPin objects.

### 5. Save Itinerary Action — Day Items Payload

The save action receives a flat array instead of the nested `Record<number, PlannedPin[]>`:

```typescript
interface SaveDayItem {
  pinId: string;
  dayNumber: number;
  sortOrder: number;
}

export async function saveItineraryAction(
  itineraryId: string,
  items: SaveDayItem[]
): Promise<ActionResult<void>> {
  // ... auth guard, validate itineraryId, validate each item ...
  // Delete existing items for this itinerary (ownership verified via RLS)
  // Insert new items
}
```

The Planner_Store serializes its `dayItems` state into this flat array before calling the action.

### 6. Planner Store Migration (`src/store/usePlannerStore.ts`)

Changes:
- Remove `import { createClient } from '@/utils/supabase/client'` for mutation paths
- Keep client import only for read operations (`fetchItineraries`, `loadItinerary`) which don't need auth guard protection (they're read-only and RLS-protected)
- Each mutation method calls the corresponding Server Action and handles the ActionResult

Example migration for `createItinerary`:

```typescript
// BEFORE (client-side Supabase)
createItinerary: async (name, tripDate) => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) { return; }
  const { data, error } = await supabase.from('itineraries').insert({...}).select().single();
  // ...
}

// AFTER (Server Action)
createItinerary: async (name, tripDate) => {
  const result = await createItineraryAction(name, tripDate);
  if (!result.success) {
    useToastStore.getState().addToast(result.error, 'error');
    return;
  }
  set((state) => ({
    activeItinerary: result.data,
    itineraries: [...state.itineraries, result.data],
    dayItems: { 1: [] },
    hasUnsavedChanges: false,
  }));
}
```

### 7. Read Operations — No Migration Needed

`fetchItineraries` and `loadItinerary` remain using the browser Supabase client because:
- They are SELECT-only operations protected by RLS
- They don't modify data, so client-side auth bypass has no security impact
- Moving reads to Server Actions would add unnecessary latency and complexity
- The middleware already refreshes the session token on every navigation

## Correctness Properties

### Property 1: Auth Guard Rejects All Non-Registered Users (Req 1, 2, 3)

For all user states returned by `supabase.auth.getUser()`:
- If user is null or error is present → Auth_Guard throws "No user session found"
- If user.is_anonymous is true → Auth_Guard throws "Anonymous users cannot perform this action"
- If user.is_anonymous is false → Auth_Guard returns the user object unchanged

This is a partition property: the input space (user states) is exhaustively covered by three partitions, and each partition maps to exactly one outcome.

### Property 2: Input Validation Rejects Invalid Names (Req 4)

For all strings `s`:
- If `s.trim().length === 0` → validation fails
- If `s.length > 200` → validation fails
- Otherwise → validation returns `s.trim()`

Property: `validateName(s)` throws if and only if `s.trim()` is empty or `s.length > 200`.

### Property 3: UUID Validation (Req 4)

For all strings `s`:
- `validateUUID(s)` succeeds if and only if `s` matches the UUID v4 regex pattern.

Property: the validation function is equivalent to the regex test — no false positives or false negatives.

### Property 4: Server Actions Never Throw (Req 6)

For all possible inputs and all possible failure modes of dependencies (auth, validation, database):
- Every Server Action returns an `ActionResult` object (never throws an unhandled exception).

Property: wrapping any Server Action call in try/catch, the catch block is never reached. The result is always `{ success: true, ... }` or `{ success: false, ... }`.

### Property 5: Ownership Scope on Mutations (Req 2, 3)

For all delete and update operations:
- The Supabase query includes `.eq('user_id', user.id)` where `user.id` comes from the Auth_Guard.
- A user cannot delete or rename another user's itinerary even if they know the itinerary ID.

This is verified by inspecting the query builder calls in tests (mock verification).

### Property 6: Save Itinerary Round-Trip (Req 3, 5)

For all valid day item arrays:
- Calling `saveItineraryAction(id, items)` followed by `loadItinerary(id)` produces a state where the loaded items match the saved items in pin IDs, day numbers, and sort orders.

Property: save then load is a round-trip — the data survives the serialization/deserialization through the database.

### Property 7: Store State Consistency After Server Action Failure (Req 5)

For all Server Action failures:
- The Planner_Store state remains unchanged (no partial updates).
- A toast error message is displayed.

Property: if `result.success === false`, the store's state before and after the call is identical (except for toast side-effect).
