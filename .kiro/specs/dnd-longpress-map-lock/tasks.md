# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** — DnD Long-Press & Map Lock Defects
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate all six defects exist
  - **Scoped PBT Approach**: Each defect is deterministic, so scope properties to concrete failing cases
  - Test file: `src/hooks/__tests__/usePlannerDnd.bugcondition.test.ts`
  - Test 1a: Assert `usePlannerDnd` configures `PointerSensor` with `{ delay: 500, tolerance: 5 }` — will fail because current code uses `{ distance: 5 }`
  - Test file: `src/components/__tests__/AppLayout.bugcondition.test.ts`
  - Test 1b: Assert `AppLayout` renders `DndContext` wrapping the full layout (not conditionally scoped to `PlannerSidebar` only) — will fail because current code wraps only sidebar
  - Test file: `src/components/__tests__/PlannerSidebar.bugcondition.test.ts`
  - Test 1c: Assert `PlannerSidebar` does NOT have `onPointerEnter`/`onPointerLeave` handlers — will fail because current code has them
  - Test 1d: Assert `PlannerSidebar` has `onPointerMove` with `stopPropagation` — will fail because current code is missing it
  - Test file: `src/components/planner/__tests__/SavedLibrary.bugcondition.test.ts`
  - Test 1e: Assert `PinCard` renders as `motion.div` with `whileTap` prop — will fail because current code uses plain `div`
  - Test file: `src/components/__tests__/MapView.bugcondition.test.ts`
  - Test 1f: Assert `disableInteractions` calls `touchPitch.disable()` and `enableInteractions` calls `touchPitch.enable()` — will fail because current code omits `touchPitch`
  - Run all tests on UNFIXED code
  - **EXPECTED OUTCOME**: All tests FAIL (this proves the bugs exist)
  - Document counterexamples found to understand root causes
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — DnD Operations, Search/Filter, and Sidebar Close
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `src/hooks/__tests__/usePlannerDnd.preservation.test.ts`
  - Observe: `parseDayFromTarget('day-1', undefined, dayItems)` returns `1` on unfixed code
  - Observe: `parseDayFromTarget('some-pin-id', undefined, dayItems)` returns the day number containing that pin on unfixed code
  - Observe: `parseDayFromTarget('nonexistent', undefined, {})` returns `null` on unfixed code
  - Write property-based test using fast-check: for all valid `overId` strings matching `day-N` pattern, `parseDayFromTarget` returns `N`
  - Write property-based test: for all `overId` matching a pin's `itinerary_item_id` in `dayItems`, returns the correct day number
  - Write property-based test: for all `overId` not matching any target, returns `null`
  - Test file: `src/components/planner/__tests__/SavedLibrary.preservation.test.ts`
  - Observe: `filterPins(pins, '')` returns all pins on unfixed code
  - Observe: `filterPins(pins, 'tokyo')` returns only pins with "tokyo" in title or address on unfixed code
  - Observe: `groupPinsByRegion(pins)` groups by last address segment on unfixed code
  - Write property-based test using fast-check: for all pin arrays and query strings, `filterPins` returns a subset of the input where every pin matches the query (case-insensitive) in title or address
  - Write property-based test: for all pin arrays, `groupPinsByRegion` produces groups where every pin in a group has the same `extractRegion` value, and total pin count equals input count
  - Write property-based test: `extractRegion` returns last comma-separated segment or "Unknown Location" for empty/undefined input
  - Verify all tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for DnD long-press & map lock defects

  - [x] 3.1 Implement delay-based PointerSensor in `usePlannerDnd.tsx`
    - Change `useSensor(PointerSensor, { activationConstraint: { distance: 5 } })` to `useSensor(PointerSensor, { activationConstraint: { delay: 500, tolerance: 5 } })`
    - _Bug_Condition: isBugCondition(input) where context.pointerSensorConstraint.type == "distance"_
    - _Expected_Behavior: PointerSensor uses delay: 500, tolerance: 5_
    - _Preservation: KeyboardSensor with sortableKeyboardCoordinates unchanged_
    - _Requirements: 2.1, 3.5_

  - [x] 3.2 Hoist DndContext to wrap full layout in `AppLayout.tsx`
    - Move `<DndContext>` to wrap the entire layout content (MapView, PlannerSidebar, BottomNav, MagicBar, etc.)
    - Always render `DndContext` (not conditionally on `isPlannerOpen`)
    - Place `<DragOverlay>` as last child inside `DndContext`
    - Keep `PlannerSidebar` rendering conditionally based on `isPlannerOpen`
    - _Bug_Condition: isBugCondition(input) where context.dndContextParent == "PlannerSidebar"_
    - _Expected_Behavior: DndContext wraps entire layout so all drop targets are reachable_
    - _Preservation: All existing DnD operations (library→day, reorder, cross-day) unchanged_
    - _Requirements: 2.2, 3.1, 3.2, 3.3_

  - [x] 3.3 Fix PlannerSidebar event handlers
    - Remove `handlePointerEnter` and `handlePointerLeave` functions
    - Remove `onPointerEnter` and `onPointerLeave` from desktop `motion.aside` and mobile `Drawer.Content`
    - Add `onPointerMove={(e) => e.stopPropagation()}` to desktop `motion.aside` and mobile `Drawer.Content`
    - _Bug_Condition: isBugCondition(input) where context.sidebar.hasPointerEnterLeaveHandlers OR NOT context.sidebarStopsPropagation_
    - _Expected_Behavior: No enter/leave handlers; pointerMove stopPropagation on sidebar container_
    - _Preservation: Sidebar close still re-enables map interactions via existing useEffect_
    - _Requirements: 2.3, 2.5, 3.4_

  - [x] 3.4 Add framer-motion whileTap feedback on PinCard in `SavedLibrary.tsx`
    - Import `motion` from `framer-motion`
    - Convert outer `<div>` of `PinCard` to `<motion.div>`
    - Add `whileTap={{ scale: 0.97, boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}`
    - Add `transition={{ duration: 0.15 }}`
    - _Bug_Condition: isBugCondition(input) where NOT context.pinCard.hasWhileTapAnimation_
    - _Expected_Behavior: PinCard scales down and gains shadow during hold period_
    - _Preservation: Search/filter and grouping logic unchanged_
    - _Requirements: 2.4, 3.6_

  - [x] 3.5 Add touchPitch to disable/enable interactions in `MapView.tsx`
    - In `disableInteractions`: add `map.touchPitch.disable()` after `map.touchZoomRotate.disable()`
    - In `enableInteractions`: add `map.touchPitch.enable()` after `map.touchZoomRotate.enable()`
    - _Bug_Condition: isBugCondition(input) where NOT context.disableInteractions.includesTouchPitch_
    - _Expected_Behavior: touchPitch disabled/enabled alongside all other interaction handlers_
    - _Preservation: All other interaction handlers (dragPan, scrollZoom, boxZoom, dragRotate, keyboard, doubleClickZoom, touchZoomRotate) unchanged_
    - _Requirements: 2.6_

  - [x] 3.6 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** — DnD Long-Press & Map Lock Fixes
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied for all six defects
    - Run bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: All tests PASS (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** — DnD Operations, Search/Filter, and Sidebar Close
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run full test suite with `npm test`
  - Ensure all bug condition tests pass (confirming fixes work)
  - Ensure all preservation tests pass (confirming no regressions)
  - Ensure all pre-existing tests pass (no unrelated breakage)
  - Ask the user if questions arise
