# Implementation Plan: Planner Sidebar Overlay

## Overview

Migrate the Itinerary Planner from a standalone `/planner` route into a slide-in sidebar overlay within AppLayout. The implementation proceeds incrementally: extract shared DnD logic, create the PlannerSidebar component, rewire AppLayout state and rendering, clean up the old route, and add redirect middleware.

## Tasks

- [x] 1. Extract shared DnD logic from DraftingTable
  - [x] 1.1 Create a `usePlannerDnd` hook in `src/hooks/usePlannerDnd.ts`
    - Extract `handleDragStart`, `handleDragEnd`, `parseDayFromTarget`, `DragPreview`, `ActiveDragData` type, and sensor setup from `DraftingTable.tsx` into a reusable hook
    - The hook should accept no arguments and return `{ sensors, activeDrag, handleDragStart, handleDragEnd, DragPreview }`
    - It reads `addPinToDay`, `reorderPinInDay`, `movePinBetweenDays`, `dayItems` from `usePlannerStore` internally
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 1.2 Refactor `DraftingTable.tsx` to use the new `usePlannerDnd` hook
    - Replace inline DnD logic with the extracted hook
    - Verify DraftingTable still renders `LibraryPane` + `TripTimeline` inside a `DndContext` using the hook's return values
    - _Requirements: 5.1_

- [x] 2. Checkpoint — Ensure DraftingTable still works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create PlannerSidebar component
  - [x] 3.1 Create `src/components/PlannerSidebar.tsx`
    - Implement `PlannerSidebarProps` interface: `{ isOpen: boolean; onClose: () => void }`
    - Add viewport detection using `window.matchMedia('(max-width: 767px)')` with event listener (same pattern as `CollectionDrawer`)
    - Desktop (≥768px): Render a `fixed inset-y-0 right-0 z-[80] max-w-[400px] w-full` panel with Framer Motion `AnimatePresence` — `initial={{ x: '100%' }}`, `animate={{ x: 0 }}`, `exit={{ x: '100%' }}`, `transition={{ duration: 0.3, ease: 'easeInOut' }}`; apply shadow `shadow-[-10px_0_40px_rgba(0,0,0,0.1)]`
    - Mobile (<768px): Render a full-screen vaul `Drawer` with `onOpenChange` syncing back via `onClose`
    - Both layouts render `ItineraryToolbar` at top and `TripTimeline` as scrollable content below
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3_

  - [ ]* 3.2 Write unit tests for PlannerSidebar
    - Test desktop rendering: fixed positioning, max-width, z-index, shadow, ItineraryToolbar + TripTimeline present
    - Test mobile rendering: vaul Drawer rendered with correct content
    - Test animation props match spec (translate-x, 300ms, ease-in-out)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3_

- [x] 4. Rewire AppLayout for planner overlay
  - [x] 4.1 Add `isPlannerOpen` state and planner toggle logic to `AppLayout.tsx`
    - Add `const [isPlannerOpen, setIsPlannerOpen] = useState(false)` and `const itinerariesLoadedRef = useRef(false)`
    - Modify `handleTabChange('plan')` to toggle `isPlannerOpen` instead of `router.push('/planner')`
    - When toggling planner ON: close ProfileSheet and DiscoverFeed, set `activeTab` to `'plan'`, call `fetchItineraries()` if not yet loaded (guard with `itinerariesLoadedRef`)
    - When toggling planner OFF: set `activeTab` to `'add'`
    - When opening Discover or Profile while planner is open: set `isPlannerOpen` to `false`
    - Remove the `useRouter` import and `router.push('/planner')` call
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2, 7.3, 7.4_

  - [x] 4.2 Render PlannerSidebar and DndContext in AppLayout
    - Import `PlannerSidebar`, `usePlannerDnd` hook, `DndContext`, `DragOverlay`, and `CollectionDrawer`
    - When `isPlannerOpen` is true, wrap `CollectionDrawer` + `PlannerSidebar` in a `DndContext` using the `usePlannerDnd` hook's sensors and handlers
    - Render `DragOverlay` with the hook's `DragPreview` inside the `DndContext`
    - Pass `isOpen={isPlannerOpen}` and `onClose={() => setIsPlannerOpen(false)}` to `PlannerSidebar`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 4.3 Add MapView resize call on planner state change
    - Add a `useEffect` that watches `isPlannerOpen` and calls `mapViewRef.current?.resize()` after a 300ms `setTimeout` on desktop (check `window.matchMedia('(min-width: 768px)')`)
    - Clear the timeout on cleanup to handle rapid toggles
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 4.4 Write property test for plan tab toggle (Property 1)
    - **Property 1: Plan tab toggle is a boolean flip**
    - Generate random sequences of tap counts (1–50) and random initial states with `fast-check`
    - Verify `isPlannerOpen` matches `N % 2 !== 0` (if initial was false) or `N % 2 === 0` (if initial was true) after N taps
    - **Validates: Requirements 1.1**

  - [ ]* 4.5 Write property test for overlay mutual exclusivity (Property 2)
    - **Property 2: Opening the planner closes all other overlays**
    - Generate random combinations of `{ isProfileOpen, isDiscoverOpen }` booleans with `fast-check`
    - Simulate opening the planner, verify both `isProfileOpen` and `isDiscoverOpen` are `false`
    - **Validates: Requirements 7.1**

  - [ ]* 4.6 Write unit tests for AppLayout planner integration
    - Test MapView.resize() timing: mock resize, toggle isPlannerOpen, advance timers 300ms, verify resize called once
    - Test itinerary fetch on first open: mock fetchItineraries, open planner twice, verify called only once
    - Test overlay mutual exclusivity: open ProfileSheet then tap Plan, verify ProfileSheet closes
    - Test plan tab toggle-off resets activeTab to "add"
    - _Requirements: 1.1, 1.4, 4.2, 4.3, 7.1, 7.2_

- [x] 5. Checkpoint — Ensure planner sidebar renders and DnD works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Route cleanup and redirect
  - [x] 6.1 Delete `src/app/planner/page.tsx`
    - Remove the standalone planner page file
    - _Requirements: 6.1_

  - [x] 6.2 Add `/planner` redirect in `src/middleware.ts`
    - Add a check at the top of the `middleware` function: if `request.nextUrl.pathname === '/planner'`, return `NextResponse.redirect(new URL('/', request.url))`
    - _Requirements: 6.2_

  - [ ]* 6.3 Write unit test for middleware redirect
    - Test that a request to `/planner` returns a redirect response to `/`
    - _Requirements: 6.2_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Existing components (ItineraryToolbar, TripTimeline, DayContainer, BridgeElement, LibraryPane, CollectionDrawer) are reused as-is
