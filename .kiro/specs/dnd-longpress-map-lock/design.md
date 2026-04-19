# DnD Long-Press & Map Lock Bugfix Design

## Overview

Six interrelated defects cause the planner drag-and-drop system to conflict with map interactions on touch and pointer devices. The core issue is that the `PointerSensor` activates on 5px of movement (indistinguishable from a map pan), the `DndContext` scope is too narrow, pointer events leak from the sidebar to the map, `onPointerEnter/Leave` unreliably toggles map controls, there is no visual feedback during drag activation, and `touchPitch` is never disabled during interaction lockout. The fix replaces the distance-based sensor with a 500ms delay-based sensor, hoists `DndContext` to wrap the full layout, adds `onPointerMove` stopPropagation, removes the unreliable enter/leave handlers, adds framer-motion `whileTap` feedback on `PinCard`, and includes `touchPitch` in the interaction toggle pair.

## Glossary

- **Bug_Condition (C)**: The set of pointer/touch interactions where the current code produces incorrect behavior — drag activates too easily, events leak to the map, or interactions are incompletely locked
- **Property (P)**: The desired behavior — drag activates only after a deliberate 500ms hold, events are contained within the sidebar, map interactions are fully locked during drag, and visual feedback is provided
- **Preservation**: All existing DnD operations (library→day, reorder, cross-day move), keyboard sensor, search/filter, sidebar open/close map re-enable, and cinematic flyTo must remain unchanged
- **`usePlannerDnd`**: The hook in `src/hooks/usePlannerDnd.tsx` that configures sensors, drag start/end handlers, and the drag overlay preview
- **`AppLayout`**: The root layout component in `src/components/AppLayout.tsx` that orchestrates `DndContext`, `MapView`, and `PlannerSidebar`
- **`PlannerSidebar`**: The sidebar component in `src/components/PlannerSidebar.tsx` that renders planner content in a desktop panel or mobile drawer
- **`SavedLibrary`**: The pin library component in `src/components/planner/SavedLibrary.tsx` containing draggable `PinCard` elements
- **`MapView`**: The maplibre-gl wrapper in `src/components/MapView.tsx` exposing `disableInteractions`/`enableInteractions` via ref
- **`PointerSensor`**: The `@dnd-kit/core` sensor that detects pointer-based drag gestures
- **`touchPitch`**: The maplibre-gl interaction handler that allows pitch changes via two-finger touch gestures

## Bug Details

### Bug Condition

The bug manifests as six co-occurring defects when a user interacts with the planner sidebar on a device with pointer or touch input. The `PointerSensor` uses `distance: 5` which cannot distinguish drag intent from map panning, the `DndContext` is scoped too narrowly, pointer events propagate to the map, enter/leave handlers unreliably toggle map controls, no visual feedback exists during activation, and `touchPitch` is omitted from the interaction lockout.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { event: PointerEvent | TouchEvent, context: AppState }
  OUTPUT: boolean

  sensorIsDistanceBased := context.pointerSensorConstraint.type == "distance"
  dndScopedToSidebar := context.dndContextParent == "PlannerSidebar"
  pointerMovePropagates := NOT context.sidebarStopsPropagation
  usesEnterLeaveToggle := context.sidebar.hasPointerEnterLeaveHandlers
  noTapFeedback := NOT context.pinCard.hasWhileTapAnimation
  touchPitchNotDisabled := NOT context.disableInteractions.includesTouchPitch

  RETURN sensorIsDistanceBased
         OR dndScopedToSidebar
         OR pointerMovePropagates
         OR usesEnterLeaveToggle
         OR noTapFeedback
         OR touchPitchNotDisabled
END FUNCTION
```

### Examples

- **Defect 1 — Sensor**: User touches a PinCard and moves 5px to scroll → drag activates immediately instead of waiting for a deliberate hold. Expected: no drag activation until 500ms hold with ≤5px movement.
- **Defect 2 — DndContext scope**: User drags a pin from SavedLibrary toward a DayContainer that is rendered outside the `DndContext` boundary → drop target is not detected. Expected: `DndContext` wraps the full layout so all drop targets are reachable.
- **Defect 3 — Enter/Leave handlers**: User moves pointer quickly across the sidebar edge → `onPointerLeave` fires but map re-enables while drag is still active. Expected: map interactions are toggled only via `onDragStart`/`onDragEnd`.
- **Defect 4 — No visual feedback**: User presses and holds a PinCard for 500ms → no visual indication that drag is about to activate. Expected: card scales down and gains shadow during the hold period.
- **Defect 5 — Pointer propagation**: User moves pointer inside the sidebar → `pointermove` events reach the map and cause subtle panning. Expected: `onPointerMove` calls `stopPropagation()` on the sidebar container.
- **Defect 6 — touchPitch**: `disableInteractions()` is called during drag → `touchPitch` remains enabled, allowing two-finger pitch on touch devices. Expected: `touchPitch.disable()` is called alongside all other interaction disables.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Library pin drag-and-drop onto a day container adds the pin to the target day (Req 3.1)
- Planned pin reorder within the same day works correctly (Req 3.2)
- Planned pin cross-day move works correctly (Req 3.3)
- Closing the planner sidebar re-enables all map interactions (Req 3.4)
- `KeyboardSensor` with `sortableKeyboardCoordinates` continues to function (Req 3.5)
- SavedLibrary search/filter groups pins by region correctly (Req 3.6)
- `DragPreview` overlay renders correctly during drag
- Cinematic `flyToPin` animation and marker sync are unaffected

**Scope:**
All inputs that do NOT involve the six defect conditions should be completely unaffected by this fix. This includes:
- Keyboard-based drag-and-drop operations
- Mouse clicks on non-draggable UI elements
- Map interactions when the planner sidebar is closed
- Pin search and filtering in SavedLibrary
- Sidebar open/close animations and state management

## Hypothesized Root Cause

Based on the bug description and code analysis, the six defects have these root causes:

1. **Distance-based PointerSensor** (`usePlannerDnd.tsx` line ~65): `useSensor(PointerSensor, { activationConstraint: { distance: 5 } })` activates on 5px of movement. On touch devices, this is indistinguishable from a scroll or map pan gesture. The fix is to switch to `{ delay: 500, tolerance: 5 }`.

2. **Narrow DndContext scope** (`AppLayout.tsx` lines ~107-120): The `DndContext` only wraps `PlannerSidebar` and `DragOverlay`, not the full layout. This means drop targets outside the sidebar (if any future layout changes occur) and the overlay z-index stacking are suboptimal. The fix is to hoist `DndContext` to wrap the entire layout content.

3. **Unreliable onPointerEnter/Leave** (`PlannerSidebar.tsx` lines ~63-64): `handlePointerEnter` and `handlePointerLeave` call `disableInteractions`/`enableInteractions` on the map. These fire unreliably during fast pointer movement and conflict with the `onDragStart`/`onDragEnd` callbacks that also toggle map interactions. The fix is to remove these handlers entirely and rely solely on the drag lifecycle callbacks.

4. **No whileTap feedback** (`SavedLibrary.tsx` `PinCard` component): The `PinCard` is a plain `div` with no visual feedback during the 500ms activation hold. The fix is to wrap it with framer-motion's `motion.div` and add `whileTap={{ scale: 0.97, boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}`.

5. **Pointer event propagation** (`PlannerSidebar.tsx` sidebar container): The sidebar has `onPointerDown` stopPropagation but no `onPointerMove` stopPropagation. Pointer move events leak through to the map. The fix is to add `onPointerMove={(e) => e.stopPropagation()}` on the sidebar container elements.

6. **Missing touchPitch disable** (`MapView.tsx` `disableInteractions`/`enableInteractions`): The `disableInteractions` callback disables `dragPan`, `scrollZoom`, `boxZoom`, `dragRotate`, `keyboard`, `doubleClickZoom`, and `touchZoomRotate` — but omits `touchPitch`. The fix is to add `map.touchPitch.disable()` and `map.touchPitch.enable()`.

## Correctness Properties

Property 1: Bug Condition — Delay-Based Drag Activation

_For any_ pointer interaction on a PinCard where the user presses and holds for ≥500ms without moving more than 5px, the fixed `usePlannerDnd` hook SHALL activate the drag operation. For any pointer interaction where the user moves >5px before 500ms elapses, the drag SHALL NOT activate.

**Validates: Requirements 2.1**

Property 2: Bug Condition — DndContext Wraps Full Layout

_For any_ drag operation initiated from the SavedLibrary, the fixed `AppLayout` SHALL render the `DndContext` wrapping the entire layout (including `MapView`), ensuring all drop targets are reachable and the `DragOverlay` renders at root level.

**Validates: Requirements 2.2**

Property 3: Bug Condition — Drag Lifecycle Map Toggle

_For any_ drag start event, the fixed code SHALL disable map interactions exclusively via the `onDragStart` callback, and for any drag end event, SHALL re-enable map interactions exclusively via the `onDragEnd` callback, without using `onPointerEnter`/`onPointerLeave` handlers.

**Validates: Requirements 2.3**

Property 4: Bug Condition — Visual Tap Feedback

_For any_ press-and-hold interaction on a PinCard during the 500ms activation period, the fixed `PinCard` component SHALL apply a scale-down and shadow animation via framer-motion `whileTap`, providing visual feedback that a drag is about to activate.

**Validates: Requirements 2.4**

Property 5: Bug Condition — Pointer Move Containment

_For any_ pointer move event within the PlannerSidebar, the fixed sidebar container SHALL call `stopPropagation()` on the `onPointerMove` handler, preventing the event from reaching the map.

**Validates: Requirements 2.5**

Property 6: Bug Condition — Complete Interaction Lockout

_For any_ call to `disableInteractions()` on the MapView, the fixed function SHALL disable `touchPitch` in addition to all other interaction handlers. For any call to `enableInteractions()`, the fixed function SHALL re-enable `touchPitch`.

**Validates: Requirements 2.6**

Property 7: Preservation — DnD Operations Unchanged

_For any_ drag-and-drop operation (library→day, same-day reorder, cross-day move) where the bug condition does NOT apply, the fixed code SHALL produce the same result as the original code, preserving correct pin placement, reordering, and movement logic.

**Validates: Requirements 3.1, 3.2, 3.3**

Property 8: Preservation — Sidebar Close and Keyboard Sensor

_For any_ sidebar close event or keyboard-based drag operation, the fixed code SHALL produce the same behavior as the original code, preserving map re-enable on close and `KeyboardSensor` with `sortableKeyboardCoordinates`.

**Validates: Requirements 3.4, 3.5**

Property 9: Preservation — Search and Filter

_For any_ search query in the SavedLibrary, the fixed code SHALL produce the same filtered and grouped pin results as the original code.

**Validates: Requirements 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/hooks/usePlannerDnd.tsx`

**Function**: `usePlannerDnd` — sensor configuration

**Specific Changes**:
1. **Replace distance-based PointerSensor with delay-based**: Change `useSensor(PointerSensor, { activationConstraint: { distance: 5 } })` to `useSensor(PointerSensor, { activationConstraint: { delay: 500, tolerance: 5 } })`. This ensures drag only activates after a deliberate 500ms press-and-hold, with up to 5px of movement tolerance during the hold period.

---

**File**: `src/components/AppLayout.tsx`

**Function**: `AppLayout` — component render

**Specific Changes**:
2. **Hoist DndContext to wrap entire layout**: Move the `<DndContext>` to wrap all children inside the root `<div>`, not just `PlannerSidebar`. The `DndContext` should always be rendered (not conditionally on `isPlannerOpen`) so that sensors and collision detection are available globally. The `DragOverlay` should be rendered inside this context at root level.
   - Remove the conditional `{isPlannerOpen ? (<DndContext>...</DndContext>) : null}` block
   - Wrap the entire layout content with `<DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>`
   - Place `<DragOverlay>` as the last child inside `DndContext`
   - Keep `PlannerSidebar` rendering conditionally based on `isPlannerOpen` but outside the conditional DndContext wrapper

---

**File**: `src/components/PlannerSidebar.tsx`

**Function**: `PlannerSidebar` — event handlers

**Specific Changes**:
3. **Remove onPointerEnter/Leave handlers**: Delete the `handlePointerEnter` and `handlePointerLeave` functions and remove `onPointerEnter={handlePointerEnter}` and `onPointerLeave={handlePointerLeave}` from both the desktop `motion.aside` and mobile `Drawer.Content` elements. Map interaction toggling is handled by `onDragStart`/`onDragEnd` in `usePlannerDnd`.
4. **Add onPointerMove stopPropagation**: Add `onPointerMove={(e) => e.stopPropagation()}` to both the desktop `motion.aside` and mobile `Drawer.Content` elements to prevent pointer move events from reaching the map.

---

**File**: `src/components/planner/SavedLibrary.tsx`

**Function**: `PinCard` — component render

**Specific Changes**:
5. **Add framer-motion whileTap feedback**: Convert the outer `<div>` of `PinCard` to a `<motion.div>` from framer-motion. Add `whileTap={{ scale: 0.97, boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}` and `transition={{ duration: 0.15 }}` to provide visual feedback during the 500ms hold activation period. Import `motion` from `framer-motion`.

---

**File**: `src/components/MapView.tsx`

**Functions**: `disableInteractions`, `enableInteractions`

**Specific Changes**:
6. **Add touchPitch to interaction toggle**: In `disableInteractions`, add `map.touchPitch.disable()` after the existing `map.touchZoomRotate.disable()` call. In `enableInteractions`, add `map.touchPitch.enable()` after the existing `map.touchZoomRotate.enable()` call.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that inspect the sensor configuration, component structure, event handler presence, and interaction toggle completeness. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Sensor Config Test**: Assert that `usePlannerDnd` configures `PointerSensor` with `{ delay: 500, tolerance: 5 }` (will fail on unfixed code — currently uses `{ distance: 5 }`)
2. **DndContext Scope Test**: Assert that `AppLayout` renders `DndContext` wrapping the full layout including `MapView` (will fail on unfixed code — currently wraps only `PlannerSidebar`)
3. **Enter/Leave Handler Test**: Assert that `PlannerSidebar` does NOT have `onPointerEnter`/`onPointerLeave` handlers (will fail on unfixed code — currently has them)
4. **WhileTap Feedback Test**: Assert that `PinCard` renders as a `motion.div` with `whileTap` prop (will fail on unfixed code — currently a plain `div`)
5. **Pointer Move Propagation Test**: Assert that the sidebar container has `onPointerMove` with `stopPropagation` (will fail on unfixed code — currently missing)
6. **TouchPitch Lockout Test**: Assert that `disableInteractions` calls `touchPitch.disable()` (will fail on unfixed code — currently omits it)

**Expected Counterexamples**:
- Sensor uses `distance: 5` instead of `delay: 500, tolerance: 5`
- `DndContext` is scoped to `PlannerSidebar` only
- `onPointerEnter`/`onPointerLeave` handlers exist on sidebar
- `PinCard` has no `whileTap` animation
- No `onPointerMove` stopPropagation on sidebar
- `touchPitch` is not included in `disableInteractions`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedSystem(input)
  ASSERT expectedBehavior(result)
END FOR
```

Specifically:
- For sensor: verify delay-based activation constraint is configured
- For DndContext: verify it wraps the full layout
- For event handlers: verify enter/leave removed, pointerMove stopPropagation added
- For PinCard: verify whileTap animation is present
- For MapView: verify touchPitch is toggled in both disable and enable

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

**Test Plan**: Observe behavior on UNFIXED code first for DnD operations (library→day, reorder, cross-day), search/filter, and sidebar close, then write property-based tests capturing that behavior.

**Test Cases**:
1. **DnD Library→Day Preservation**: Verify that `parseDayFromTarget` and `handleDragEnd` correctly add library pins to target days for arbitrary valid inputs
2. **DnD Reorder Preservation**: Verify that same-day reorder logic produces correct index swaps for arbitrary day configurations
3. **DnD Cross-Day Preservation**: Verify that cross-day move logic correctly transfers pins between arbitrary day pairs
4. **Search/Filter Preservation**: Verify that `filterPins` and `groupPinsByRegion` produce identical results for arbitrary pin sets and query strings
5. **Sidebar Close Preservation**: Verify that closing the sidebar re-enables map interactions

### Unit Tests

- Test `usePlannerDnd` sensor configuration returns delay-based constraint
- Test `MapView.disableInteractions` disables all 8 interaction handlers including `touchPitch`
- Test `MapView.enableInteractions` enables all 8 interaction handlers including `touchPitch`
- Test `PlannerSidebar` does not have `onPointerEnter`/`onPointerLeave` props
- Test `PlannerSidebar` has `onPointerMove` with stopPropagation
- Test `PinCard` renders with `whileTap` animation props

### Property-Based Tests

- Generate random `Pin` arrays and search queries, verify `filterPins` and `groupPinsByRegion` produce consistent results (preservation of Req 3.6)
- Generate random `DragEndEvent` configurations with valid `overId` and `dayItems`, verify `parseDayFromTarget` returns correct day numbers (preservation of Req 3.1, 3.2, 3.3)
- Generate random `dayItems` maps and reorder indices, verify reorder logic produces valid permutations (preservation of Req 3.2)

### Integration Tests

- Test full drag flow: press-and-hold PinCard for 500ms → drag activates → drop on DayContainer → pin added to day
- Test that map does not pan during sidebar interaction when `onPointerMove` stopPropagation is active
- Test that `touchPitch` is disabled during drag and re-enabled after drop
- Test that closing the planner sidebar re-enables all map interactions including `touchPitch`
