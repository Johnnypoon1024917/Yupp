# Design Document: UX Polish — Production Grade

## Overview

This design delivers four production-grade UX improvements to the YUPP travel planning app:

1. **Skeleton loaders** for `TripTimeline` during itinerary data fetches
2. **Optimistic UI** for drag-and-drop operations in the Zustand planner store with rollback on failure
3. **Toast notification system** for non-blocking, accessible status messages app-wide
4. **Empty state illustration** for blank itineraries in `DraftingTable`

These changes eliminate blank screens, network-dependent lag, raw error messages, and lifeless empty states. No new external dependencies are introduced — the toast system is built with `framer-motion` (already installed) and a lightweight Zustand store.

## Architecture

```mermaid
graph TD
    subgraph UI Layer
        TT[TripTimeline]
        DC[DayContainer]
        DT[DraftingTable]
        MB[MagicBar]
        TC[ToastContainer]
        SK[PinCardSkeleton]
        ES[EmptyState]
    end

    subgraph State Layer
        PS[usePlannerStore]
        TS[useToastStore]
    end

    subgraph Async Layer
        SB[Supabase saveItinerary]
        SA[scrapeUrl / geocodeLocation]
    end

    DT -->|empty check| ES
    DT -->|has pins| TT
    TT -->|loading| SK
    TT -->|loaded| DC
    PS -->|optimistic mutation| DC
    PS -->|rollback on fail| SB
    PS -->|toast on error| TS
    MB -->|toast on error| TS
    TS --> TC
    TC -->|render| UI Layer
```

The architecture introduces two new components (`PinCardSkeleton`, `EmptyState`), one new store (`useToastStore`), and one new container (`ToastContainer`). The existing `usePlannerStore` is extended with optimistic update + rollback logic. The `MagicBar` error handling is refactored to use the toast system instead of inline error elements.

## Components and Interfaces

### PinCardSkeleton

**File:** `src/components/planner/PinCardSkeleton.tsx`

A stateless component that renders a shimmering placeholder matching `TimelineCard` dimensions.

```tsx
export default function PinCardSkeleton(): JSX.Element;
```

- Renders a 64×64 `bg-neutral-100 animate-pulse rounded-lg` rectangle (image area) and a text-width `bg-neutral-100 animate-pulse rounded` rectangle (title area)
- Used inside `DayContainer` when loading state is active

### EmptyState

**File:** `src/components/planner/EmptyState.tsx`

A stateless component that renders the empty itinerary illustration.

```tsx
export default function EmptyState(): JSX.Element;
```

- Renders a centered `MapPin` icon from `lucide-react`
- Displays the copy: "Your canvas is empty. Paste a TikTok or Xiaohongshu link to start building your dream trip."
- Uses `text-neutral-400` and `text-[13px]` typography

### ToastContainer

**File:** `src/components/ToastContainer.tsx`

A client component mounted in `layout.tsx` that renders active toasts.

```tsx
export default function ToastContainer(): JSX.Element;
```

- Reads from `useToastStore` and renders up to 3 visible toasts
- Positioned `fixed bottom-6 left-1/2 -translate-x-1/2` with `z-50`
- Each toast has `role="status"` and `aria-live="polite"`
- Uses `framer-motion` `AnimatePresence` for enter (slide up + fade in) and exit (slide down + fade out) animations

### useToastStore

**File:** `src/store/useToastStore.ts`

A Zustand store managing the toast notification queue.

```ts
export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
}

export interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, variant: ToastVariant) => void;
  removeToast: (id: string) => void;
}
```

- `addToast`: creates a toast with a UUID, appends to array, enforces max 3 (evicts oldest), sets a 4-second auto-dismiss timeout
- `removeToast`: removes a toast by ID

### usePlannerStore Extensions

**File:** `src/store/usePlannerStore.ts` (modified)

New state fields:

```ts
isLoadingItinerary: boolean;       // true while loadItinerary is in flight
isSaving: boolean;                 // true while background saveItinerary is in flight
```

Modified actions:

- `loadItinerary`: sets `isLoadingItinerary = true` before fetch, `false` after resolve/reject
- `reorderPinInDay`: captures snapshot → applies local mutation → fires `saveItinerary` in background → rollback + toast on failure
- `movePinBetweenDays`: same optimistic pattern as `reorderPinInDay`

### MagicBar Modifications

**File:** `src/components/MagicBar.tsx` (modified)

- Remove the inline `<motion.p>` error element
- Import `useToastStore` and call `addToast` for all error conditions
- Map `scrapeUrl` failure → user-friendly toast message (not raw error)
- Map all-geocode failure → specific coffee break message
- Map network/unexpected errors → generic retry message
- After displaying toast, reset state to `idle` within 300ms via `setTimeout`

### DraftingTable Modifications

**File:** `src/components/planner/DraftingTable.tsx` (modified)

- Import `usePlannerStore` to read `dayItems`
- Compute `isEmpty`: all days have zero pins
- Conditionally render `<EmptyState />` instead of `<TripTimeline />` when empty

### TripTimeline Modifications

**File:** `src/components/planner/TripTimeline.tsx` (modified)

- Read `isLoadingItinerary` from `usePlannerStore`
- When loading, render day containers with 3 `PinCardSkeleton` each instead of real cards
- When load fails, show empty day state (existing behavior)

### DayContainer Modifications

**File:** `src/components/planner/DayContainer.tsx` (modified)

- Accept optional `isLoading?: boolean` prop
- When `isLoading` is true, render 3 `PinCardSkeleton` components instead of the sortable pin list

### layout.tsx Modifications

**File:** `src/app/layout.tsx` (modified)

- Mount `<ToastContainer />` inside `<body>` so toasts are available app-wide

## Data Models

### Toast

```ts
{
  id: string;          // UUID v4
  message: string;     // Display text
  variant: ToastVariant; // 'success' | 'error' | 'info'
  createdAt: number;   // Date.now() timestamp
}
```

### PlannerStore State Extensions

```ts
{
  isLoadingItinerary: boolean;  // Loading flag for skeleton display
  isSaving: boolean;            // Background save in-flight flag
}
```

No database schema changes are required. All new state is client-side only.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Synchronous local mutation

*For any* valid `dayItems` state and any valid drag-and-drop operation (same-day reorder with valid indices, or cross-day move with valid source/target), applying the mutation SHALL update the local `dayItems` state synchronously — the returned state differs from the input state before any async call resolves.

**Validates: Requirements 2.1, 2.2**

### Property 2: Optimistic rollback round-trip

*For any* valid `dayItems` state and any valid drag-and-drop mutation, if the background `saveItinerary` call fails, rolling back SHALL produce a `dayItems` state that is deeply equal to the pre-mutation snapshot.

**Validates: Requirements 2.3, 2.5, 6.3**

### Property 3: Non-blocking mutation queue

*For any* sequence of N valid drag-and-drop mutations applied while a `saveItinerary` call is in flight, all N mutations SHALL be applied to the local `dayItems` state without blocking — the final local state reflects all N mutations applied in order.

**Validates: Requirements 2.7**

### Property 4: Toast queue capacity invariant

*For any* sequence of `addToast` calls, the number of visible toasts in the store SHALL never exceed 3. When a 4th toast is added, the oldest toast SHALL be evicted.

**Validates: Requirements 3.4**

### Property 5: Error message sanitization

*For any* `scrapeUrl` error string, the toast message displayed by `MagicBar` SHALL NOT be equal to the raw error string — it must be mapped to a user-friendly message.

**Validates: Requirements 4.1**

### Property 6: Empty state iff zero pins

*For any* `dayItems` record, the empty state is rendered if and only if every day array has length 0. Equivalently: adding a pin to any day in an all-empty state SHALL cause the empty state to no longer be rendered.

**Validates: Requirements 5.1, 5.6**

### Property 7: dayItems JSON serialization round-trip

*For any* valid `dayItems` state object (Record<number, PlannedPin[]>), `JSON.parse(JSON.stringify(dayItems))` SHALL produce a deeply equal object.

**Validates: Requirements 6.1**

### Property 8: Skeleton and real card mutual exclusivity

*For any* `isLoadingItinerary` boolean state, the TripTimeline SHALL render either skeleton placeholders or real pin cards, and SHALL NOT render both simultaneously. When `isLoadingItinerary` is true, only skeletons are present; when false, only real cards (or empty state) are present.

**Validates: Requirements 6.2**

## Error Handling

| Scenario | Behavior |
|---|---|
| `loadItinerary` fails | Set `isLoadingItinerary = false`, clear skeletons, show empty day state |
| `saveItinerary` fails after optimistic mutation | Rollback `dayItems` to snapshot, show "Sync failed. Reverting changes." toast |
| `scrapeUrl` returns failure | Show user-friendly error toast, reset MagicBar to idle in 300ms |
| All `geocodeLocation` calls fail | Show "Our AI is currently taking a coffee break..." toast, reset to idle |
| Network/unexpected error in MagicBar | Show "Something went wrong. Please try again in a moment." toast, reset to idle |
| Toast queue overflow (>3) | Evict oldest toast, add new one |

## Testing Strategy

### Property-Based Tests (fast-check, already in devDependencies)

Each correctness property maps to a single property-based test with minimum 100 iterations.

- **Property 1**: Generate random `dayItems` + random valid reorder/move params → verify synchronous state change
- **Property 2**: Generate random `dayItems` + random mutation → apply → rollback → assert deep equality with original
- **Property 3**: Generate random mutation sequences (1–5 ops) → apply all while save is pending → verify all reflected in state
- **Property 4**: Generate random sequences of `addToast` calls (1–10) → verify `toasts.length <= 3` after each call
- **Property 5**: Generate random error strings → call error mapping function → verify output !== input
- **Property 6**: Generate random `dayItems` with varying day counts (1–7) and pin counts (0–5 per day) → verify empty state condition matches `allPinsCount === 0`
- **Property 7**: Generate random `dayItems` → JSON round-trip → assert deep equality
- **Property 8**: Generate random boolean `isLoadingItinerary` + random `dayItems` → verify skeleton/card exclusivity

Tag format: `Feature: ux-polish-production-grade, Property {N}: {title}`

### Unit Tests (vitest)

- `PinCardSkeleton` renders correct CSS classes (`animate-pulse`, `bg-neutral-100`, dimensions)
- `EmptyState` renders correct text and icon
- `ToastContainer` renders toasts with `role="status"` and `aria-live="polite"`
- Toast auto-dismiss after 4 seconds (fake timers)
- Toast variants: success, error, info each render with appropriate styling
- MagicBar: scrapeUrl failure → toast called (not inline error)
- MagicBar: all geocode failure → exact coffee break message
- MagicBar: network error → exact generic message
- MagicBar: no `<motion.p>` error element in DOM after error
- MagicBar: state resets to idle within 300ms of error toast
- DraftingTable: renders EmptyState when all days empty
- DraftingTable: renders TripTimeline when any day has pins
- TripTimeline: renders 3 skeletons per day during loading
- TripTimeline: replaces skeletons with real cards after load
- DayContainer: `isLoading=true` renders PinCardSkeleton × 3
