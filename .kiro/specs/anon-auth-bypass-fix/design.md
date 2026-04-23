# Anonymous Auth Bypass Bugfix Design

## Overview

Anonymous Supabase users (where `user.is_anonymous === true`) bypass authentication gateways because the code only checks `if (!user)`. Since `useCloudSync` automatically assigns anonymous users a valid `User` object via `signInAnonymously()`, the `!user` check is always false for them. This allows anonymous users to access the planner tab, create itineraries, and clone itineraries without registering. The fix adds an `|| user.is_anonymous` check to all three affected auth gateways.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when an anonymous user (`user.is_anonymous === true`) attempts to access planner features that require full authentication
- **Property (P)**: The desired behavior — anonymous users should be blocked from planner tab access, itinerary creation, and itinerary cloning, identical to how `null` users are blocked
- **Preservation**: Existing behavior for fully registered users (`is_anonymous === false`) and `null` users must remain unchanged
- **`handleTabChange`**: The callback in `AppLayout.tsx` that gates planner tab access with an auth check
- **`createItinerary`**: The action in `usePlannerStore.ts` that creates a new itinerary in Supabase
- **`cloneItinerary`**: The action in `usePlannerStore.ts` that clones an existing itinerary for the current user
- **`useCloudSync`**: The hook in `useCloudSync.ts` that calls `signInAnonymously()` and sets the user in the store

## Bug Details

### Bug Condition

The bug manifests when an anonymous user (created by `useCloudSync` via `supabase.auth.signInAnonymously()`) interacts with any of the three auth-gated planner features. The `handleTabChange`, `createItinerary`, and `cloneItinerary` functions only check `if (!user)`, which evaluates to `false` for anonymous users since they hold a valid Supabase `User` object.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { user: User | null, action: 'plannerTab' | 'cloneItinerary' | 'createItinerary' }
  OUTPUT: boolean

  RETURN input.user ≠ null
         AND input.user.is_anonymous = true
         AND input.action IN ['plannerTab', 'cloneItinerary', 'createItinerary']
END FUNCTION
```

### Examples

- Anonymous user taps "Plan" tab → Expected: auth modal shown. Actual: planner sidebar opens.
- Anonymous user triggers `createItinerary("My Trip")` → Expected: early return, no DB write. Actual: itinerary created in Supabase under anonymous user ID.
- Anonymous user triggers `cloneItinerary(someId)` → Expected: returns `null`, no DB write. Actual: itinerary cloned and loaded into store.
- Anonymous user with `user === null` (edge case, shouldn't happen with `useCloudSync`) → Both old and new code correctly block access.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Fully authenticated users (`user.is_anonymous === false`) can open the planner tab, create itineraries, and clone itineraries exactly as before
- Users with `user === null` are blocked from planner features and shown the auth modal, exactly as before
- Anonymous users can still save and sync pins via `useCloudSync` — anonymous sign-in is intentional for pin saving
- Mouse/touch interactions, UI rendering, and all non-auth-gated features remain unaffected

**Scope:**
All inputs where the user is either `null` or a fully registered user (`is_anonymous === false`) should be completely unaffected by this fix. This includes:
- Registered user planner access
- Registered user itinerary CRUD operations
- Null user auth modal display
- Anonymous user pin syncing via `useCloudSync`

## Hypothesized Root Cause

Based on the bug description, the root cause is straightforward:

1. **Incomplete Auth Guard Logic**: All three auth gateways use `if (!user)` which only checks for `null`/`undefined`. The Supabase `User` type has an `is_anonymous` boolean property that distinguishes anonymous sessions from real accounts, but this property is not checked.

2. **Implicit Trust of `useCloudSync` User Object**: `useCloudSync` calls `signInAnonymously()` and stores the resulting `User` object in the store via `setUser(user)`. The auth gateways downstream assume any non-null user is fully authenticated.

3. **No Intermediate Auth Level**: The codebase treats authentication as binary (user exists or not) rather than having a concept of "anonymous but present" vs "fully authenticated."

## Correctness Properties

Property 1: Bug Condition - Anonymous Users Blocked from Planner Features

_For any_ input where the user is anonymous (`user !== null && user.is_anonymous === true`) and the action is one of `plannerTab`, `createItinerary`, or `cloneItinerary`, the fixed code SHALL block the operation — showing the auth modal for planner tab access, returning early for `createItinerary`, and returning `null` for `cloneItinerary` — without creating any database records.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Registered and Null User Behavior Unchanged

_For any_ input where the user is either `null` or a fully registered user (`is_anonymous === false`), the fixed code SHALL produce exactly the same behavior as the original code, preserving planner access for registered users, auth modal display for null users, and all itinerary CRUD operations.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

The fix is minimal and surgical — add `|| user.is_anonymous` to each of the three existing `if (!user)` checks.

**File**: `src/components/AppLayout.tsx`

**Function**: `handleTabChange`

**Specific Changes**:
1. **Add anonymous check to planner tab gateway**: Change `if (!user)` to `if (!user || user.is_anonymous)` in the `handleTabChange` callback (around line 56). This ensures anonymous users see the auth modal instead of the planner sidebar.

**File**: `src/store/usePlannerStore.ts`

**Function**: `createItinerary`

**Specific Changes**:
2. **Add anonymous check to createItinerary**: Change `if (!user)` to `if (!user || user.is_anonymous)` in the `createItinerary` action (around line 148). This ensures anonymous users cannot create itineraries.

**Function**: `cloneItinerary`

**Specific Changes**:
3. **Add anonymous check to cloneItinerary**: Change `if (!user)` to `if (!user || user.is_anonymous)` in the `cloneItinerary` action (around line 280). This ensures anonymous users cannot clone itineraries.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that anonymous users currently bypass all three auth gateways.

**Test Plan**: Write tests that read the source code of the affected files and assert that the auth checks include `is_anonymous`. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **AppLayout handleTabChange Test**: Assert that the `handleTabChange` function checks `is_anonymous` in its auth guard (will fail on unfixed code)
2. **createItinerary Auth Test**: Assert that `createItinerary` checks `is_anonymous` before proceeding (will fail on unfixed code)
3. **cloneItinerary Auth Test**: Assert that `cloneItinerary` checks `is_anonymous` before proceeding (will fail on unfixed code)

**Expected Counterexamples**:
- Source code contains `if (!user)` without any `is_anonymous` check
- Anonymous users pass through the auth guard because `!user` is `false` for them

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions block anonymous users.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT result.operationBlocked = true
  ASSERT result.databaseWritten = false
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Read the source code of the fixed files and verify that the auth guard pattern `if (!user || user.is_anonymous)` is present, while also verifying that the rest of the function logic is unchanged for registered users.

**Test Cases**:
1. **Registered User Planner Access Preservation**: Verify that the auth guard passes for users with `is_anonymous === false`, preserving planner tab access
2. **Null User Auth Modal Preservation**: Verify that `null` users still trigger the auth modal / early return
3. **Registered User createItinerary Preservation**: Verify that registered users can still create itineraries
4. **Registered User cloneItinerary Preservation**: Verify that registered users can still clone itineraries

### Unit Tests

- Test `handleTabChange` blocks anonymous users and shows auth modal
- Test `createItinerary` returns early for anonymous users without DB writes
- Test `cloneItinerary` returns `null` for anonymous users without DB writes
- Test all three functions continue to work for registered users

### Property-Based Tests

- Generate random user states (null, anonymous, registered) and verify that only registered users pass the auth guard
- Generate random action types and verify anonymous users are blocked from all planner actions
- Verify that the `is_anonymous` check is additive — it doesn't change behavior for any non-anonymous user state

### Integration Tests

- Test full flow: anonymous user taps Plan tab → auth modal appears → user signs in → planner opens
- Test that anonymous pin syncing via `useCloudSync` is unaffected by the auth guard changes
- Test that cloning a public trip as an anonymous user shows auth prompt instead of silently cloning
