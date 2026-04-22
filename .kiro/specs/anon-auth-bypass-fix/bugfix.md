# Bugfix Requirements Document

## Introduction

Anonymous users created by Supabase's `signInAnonymously()` in `useCloudSync.ts` receive a valid `User` object with `is_anonymous: true`. The auth gateways in `AppLayout.tsx` (planner tab) and `usePlannerStore.ts` (`cloneItinerary`, `createItinerary`) only check `if (!user)`, which passes for anonymous users since they hold a valid user reference. This allows anonymous users to access the planner and clone/create itineraries without registering, bypassing the intended login requirement for these features.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an anonymous user (where `user.is_anonymous === true`) taps the planner tab THEN the system opens the planner sidebar without prompting for login, because `handleTabChange` in `AppLayout.tsx` only checks `if (!user)` which is false for anonymous users.

1.2 WHEN an anonymous user calls `cloneItinerary` THEN the system clones the itinerary and assigns it to the anonymous user without prompting for login, because `cloneItinerary` in `usePlannerStore.ts` only checks `if (!user)`.

1.3 WHEN an anonymous user calls `createItinerary` THEN the system creates a new itinerary owned by the anonymous user without prompting for login, because `createItinerary` in `usePlannerStore.ts` only checks `if (!user)`.

### Expected Behavior (Correct)

2.1 WHEN an anonymous user (where `user.is_anonymous === true`) taps the planner tab THEN the system SHALL display the auth modal with a login prompt instead of opening the planner, treating anonymous users the same as unauthenticated users for planner access.

2.2 WHEN an anonymous user calls `cloneItinerary` THEN the system SHALL reject the operation and return `null` without creating any database records, treating anonymous users the same as unauthenticated users for clone access.

2.3 WHEN an anonymous user calls `createItinerary` THEN the system SHALL reject the operation and return early without creating any database records, treating anonymous users the same as unauthenticated users for itinerary creation.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a fully registered/authenticated user (where `user.is_anonymous === false`) taps the planner tab THEN the system SHALL CONTINUE TO open the planner sidebar and fetch itineraries normally.

3.2 WHEN a fully registered/authenticated user calls `cloneItinerary` THEN the system SHALL CONTINUE TO clone the itinerary, insert items, and load the cloned itinerary into the store.

3.3 WHEN a fully registered/authenticated user calls `createItinerary` THEN the system SHALL CONTINUE TO create the itinerary in Supabase and set it as the active itinerary.

3.4 WHEN no user is present (`user === null`) and the planner tab is tapped THEN the system SHALL CONTINUE TO display the auth modal with a login prompt.

3.5 WHEN no user is present (`user === null`) and `cloneItinerary` is called THEN the system SHALL CONTINUE TO return `null` without creating any database records.

3.6 WHEN no user is present (`user === null`) and `createItinerary` is called THEN the system SHALL CONTINUE TO return early without creating any database records.

3.7 WHEN an anonymous user saves pins via `useCloudSync` THEN the system SHALL CONTINUE TO sync pins to the cloud normally, as anonymous sign-in is intentional for pin saving.

---

### Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type AuthGatewayInput  { user: User | null, action: 'plannerTab' | 'cloneItinerary' | 'createItinerary' }
  OUTPUT: boolean

  // Returns true when user is anonymous (valid User object with is_anonymous = true)
  RETURN X.user ≠ null AND X.user.is_anonymous = true
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking — Anonymous users are blocked from planner features
FOR ALL X WHERE isBugCondition(X) DO
  result ← F'(X)
  ASSERT result.plannerOpened = false
  ASSERT result.itineraryCreated = false
  ASSERT result.itineraryCloned = false
  ASSERT result.authModalShown = true  // for plannerTab action
END FOR
```

### Preservation Checking Property

```pascal
// Property: Preservation Checking — Registered users and null users behave identically
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
