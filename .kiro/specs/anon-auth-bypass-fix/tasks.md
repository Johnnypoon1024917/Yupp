# Tasks

## Task 1: Exploratory Bug Condition Tests

Write tests that confirm the bug exists in the unfixed code by checking that the auth guards do NOT include `is_anonymous`.

- [x] 1.1 Create `src/components/__tests__/AppLayout.anon-auth.bugcondition.test.ts` that reads `AppLayout.tsx` source and asserts the `handleTabChange` function checks `is_anonymous` in its planner tab auth guard. This test should FAIL on unfixed code.
  - Property: Property 1 (Bug Condition - Anonymous Users Blocked from Planner Features)
- [x] 1.2 Create `src/store/__tests__/usePlannerStore.anon-auth.bugcondition.test.ts` that reads `usePlannerStore.ts` source and asserts both `createItinerary` and `cloneItinerary` check `is_anonymous` in their auth guards. This test should FAIL on unfixed code.
  - Property: Property 1 (Bug Condition - Anonymous Users Blocked from Planner Features)

## Task 2: Fix Auth Guards

Apply the fix to all three affected auth gateways by adding `|| user.is_anonymous` to each `if (!user)` check.

- [x] 2.1 In `src/components/AppLayout.tsx`, update the `handleTabChange` function's auth guard from `if (!user)` to `if (!user || user.is_anonymous)` so anonymous users see the auth modal instead of the planner sidebar.
- [x] 2.2 In `src/store/usePlannerStore.ts`, update the `createItinerary` function's auth guard from `if (!user)` to `if (!user || user.is_anonymous)` so anonymous users cannot create itineraries.
- [x] 2.3 In `src/store/usePlannerStore.ts`, update the `cloneItinerary` function's auth guard from `if (!user)` to `if (!user || user.is_anonymous)` so anonymous users cannot clone itineraries.

## Task 3: Verify Exploratory Tests Pass

Re-run the exploratory bug condition tests from Task 1 to confirm they now pass on the fixed code.

- [x] 3.1 Run `src/components/__tests__/AppLayout.anon-auth.bugcondition.test.ts` and verify it passes.
- [x] 3.2 Run `src/store/__tests__/usePlannerStore.anon-auth.bugcondition.test.ts` and verify it passes.

## Task 4: Preservation Tests

Write tests that verify existing behavior is unchanged for registered users and null users.

- [x] 4.1 Create `src/components/__tests__/AppLayout.anon-auth.preservation.test.ts` that reads `AppLayout.tsx` source and verifies the auth guard still allows non-anonymous users through (the guard pattern includes `!user` as the first condition, preserving null-user blocking).
  - Property: Property 2 (Preservation - Registered and Null User Behavior Unchanged)
- [x] 4.2 Create `src/store/__tests__/usePlannerStore.anon-auth.preservation.test.ts` that reads `usePlannerStore.ts` source and verifies both `createItinerary` and `cloneItinerary` auth guards preserve the `!user` check for null users while adding the `is_anonymous` check.
  - Property: Property 2 (Preservation - Registered and Null User Behavior Unchanged)

## Task 5: Run All Tests

Run the full test suite to ensure no regressions.

- [x] 5.1 Run `npm test` and verify all tests pass, including the new bug condition and preservation tests.
