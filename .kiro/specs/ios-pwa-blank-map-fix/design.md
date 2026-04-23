# iOS PWA Blank Map Bugfix Design

## Overview

The MapLibre map renders as a blank/gray screen on iOS PWAs due to three independent issues: Stadia Maps blocking Origin-less requests, a WebKit canvas sizing race condition, and missing `100dvh` CSS fallbacks. The fix swaps the tile provider, adds a post-init resize delay, and layers CSS height fallbacks — all minimal, targeted changes with no architectural impact.

## Glossary

- **Bug_Condition (C)**: The app is running as an iOS PWA or on iOS 15 and below, causing one or more of the three failure modes
- **Property (P)**: The map renders correctly with visible tiles and proper canvas dimensions on all iOS contexts
- **Preservation**: Desktop, Android, and iOS 16+ behavior remains identical — map rendering, markers, flyTo, drag-to-plan, sidebar resize all unchanged
- **TILE_STYLE**: The constant in `src/components/MapView.tsx` holding the map style URL
- **AppLayout**: The root layout shell in `src/components/AppLayout.tsx` that wraps the entire app UI
- **`100dvh`**: Dynamic viewport height CSS unit — unsupported on iOS 15 and below

## Bug Details

### Bug Condition

The bug manifests under three independent conditions on iOS. Any one of them causes a blank map.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { platform, osVersion, isPWA, mapContainer }
  OUTPUT: boolean

  tileBlocked := input.isPWA
                 AND input.platform == 'iOS'
                 AND tileProvider == 'stadiamaps'

  canvasZero  := input.platform == 'iOS'
                 AND mapContainer.canvasWidth == 0
                 AND mapContainer.canvasHeight == 0

  dvhMissing  := input.platform == 'iOS'
                 AND input.osVersion < 16
                 AND NOT cssSupports('100dvh')

  RETURN tileBlocked OR canvasZero OR dvhMissing
END FUNCTION
```

### Examples

- **iOS PWA + Stadia**: User adds app to Home Screen on iPhone, opens it → map is gray because Stadia returns 403 (no Origin header). Expected: tiles load from CARTO.
- **iOS Safari fresh load**: User opens app in Safari on iPhone → canvas initializes at 0×0 before layout paint completes → blank map. Expected: resize fires after 100ms, canvas gets correct dimensions.
- **iOS 15 + `100dvh`**: User on iPhone with iOS 15 → `h-[100dvh]` is ignored, container collapses to 0px → map invisible. Expected: `h-screen` fallback provides `100vh` height.
- **Desktop Chrome**: User opens app on desktop → map loads normally. Expected: no change in behavior (preservation).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Map rendering on desktop browsers must continue to work with the same clean, light visual style
- Map rendering on Android browsers and PWAs must remain unaffected
- On iOS 16+ where `dvh` is supported, `100dvh` must still take effect (it overrides the fallback)
- Map markers, flyTo animations, drag-to-plan, and all MapLibre interactions must work identically
- Planner sidebar resize triggering `map.resize()` must continue to function

**Scope:**
All inputs that do NOT involve iOS PWA tile loading, iOS canvas initialization timing, or iOS 15 `dvh` support should be completely unaffected by this fix. This includes:
- All desktop browser usage
- All Android browser and PWA usage
- All non-map UI interactions (MagicBar, PlaceSheet, BottomNav, etc.)
- All existing MapLibre event handlers and marker logic

## Hypothesized Root Cause

Based on the bug description, the three root causes are:

1. **Stadia Maps Origin Header Enforcement**: Apple's WebKit strips the `Origin` header from fetch requests made by Home Screen PWAs. Stadia Maps rejects requests without a valid Origin, returning 403. The `TILE_STYLE` constant points to `tiles.stadiamaps.com`, which enforces this check.

2. **iOS WebKit Canvas Sizing Race Condition**: On iOS Safari, the MapLibre `Map` constructor reads the container's dimensions before the browser has completed its first layout paint. The container reports 0×0, so the WebGL canvas is created with zero dimensions. MapLibre does not automatically re-check after paint.

3. **Missing `100dvh` CSS Fallback**: The `h-[100dvh]` Tailwind class and `height: 100dvh` CSS property are used without fallbacks. On iOS 15 and below (which lack `dvh` support), these are ignored, collapsing the layout container and body to 0px height.

## Correctness Properties

Property 1: Bug Condition - Map Renders on iOS PWA

_For any_ app launch where the platform is iOS and the app is running as a PWA or on iOS 15 and below, the fixed code SHALL render the map with visible tiles, a correctly-sized canvas, and a non-zero-height layout container.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Non-iOS and Standard Browser Behavior

_For any_ app launch on desktop browsers, Android browsers/PWAs, or iOS 16+ with standard Safari, the fixed code SHALL produce exactly the same map rendering, layout dimensions, and interaction behavior as the original code, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `src/components/MapView.tsx`

**Change 1 — Swap Tile Provider**:
- Replace `TILE_STYLE` value from `'https://tiles.stadiamaps.com/styles/alidade_smooth.json'` to `'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'`
- CARTO Positron is a similar clean, light style that does not enforce Origin headers

**Change 2 — Add Post-Init Resize**:
- In the map initialization `useEffect`, after `mapRef.current = map;`, add:
  ```typescript
  setTimeout(() => map.resize(), 100);
  ```
- This gives iOS WebKit time to complete DOM paint before MapLibre recalculates canvas dimensions

---

**File**: `src/components/AppLayout.tsx`

**Change 3 — Add `h-screen` Fallback**:
- Change the root div className from:
  `"relative w-screen h-[100dvh] overflow-hidden overscroll-none bg-[#FAFAFA]"`
  to:
  `"relative w-screen h-screen h-[100dvh] overflow-hidden overscroll-none bg-[#FAFAFA]"`
- `h-screen` (`100vh`) provides a fallback; `h-[100dvh]` overrides it on browsers that support `dvh`

---

**File**: `src/app/globals.css`

**Change 4 — Add `height: 100%` Fallback on Body**:
- Add `height: 100%;` immediately before the existing `height: 100dvh;` in the `body` rule
- Browsers that support `dvh` will use the later declaration; older browsers use `100%`

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write unit tests that verify the tile style URL, check for the resize call after map init, and validate CSS class/property fallbacks. Run on unfixed code to observe failures.

**Test Cases**:
1. **Tile Provider Test**: Assert `TILE_STYLE` points to CARTO Positron (will fail on unfixed code — currently Stadia)
2. **Resize Delay Test**: Assert that `map.resize()` is called within 200ms of map creation (will fail on unfixed code — no such call exists)
3. **AppLayout Height Fallback Test**: Assert the root div includes both `h-screen` and `h-[100dvh]` classes (will fail on unfixed code — only `h-[100dvh]`)
4. **Body CSS Fallback Test**: Assert `globals.css` body has `height: 100%` before `height: 100dvh` (will fail on unfixed code — only `100dvh`)

**Expected Counterexamples**:
- `TILE_STYLE` equals Stadia URL instead of CARTO
- No `setTimeout` resize call after map init
- Missing `h-screen` class on layout container

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderApp_fixed(input)
  ASSERT result.tileStyleURL == 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
  ASSERT result.resizeCalledAfterInit == true
  ASSERT result.containerHeight > 0
  ASSERT result.bodyHeight > 0
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderApp_original(input).mapVisible == renderApp_fixed(input).mapVisible
  ASSERT renderApp_original(input).containerHeight == renderApp_fixed(input).containerHeight
  ASSERT renderApp_original(input).interactionsBehavior == renderApp_fixed(input).interactionsBehavior
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many viewport size and platform combinations automatically
- It catches edge cases in CSS fallback ordering that manual tests might miss
- It provides strong guarantees that non-iOS behavior is unchanged

**Test Plan**: Observe behavior on unfixed code for desktop and Android contexts, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Desktop Rendering Preservation**: Verify map renders identically on desktop viewports after fix
2. **Marker Behavior Preservation**: Verify markers, flyTo, and drag-to-plan work unchanged
3. **Sidebar Resize Preservation**: Verify planner sidebar toggle still triggers correct map resize

### Unit Tests

- Test that `TILE_STYLE` constant equals the CARTO Positron URL
- Test that map init `useEffect` calls `setTimeout` with `map.resize()` after creation
- Test that AppLayout root div has both `h-screen` and `h-[100dvh]` classes
- Test that `globals.css` body rule includes `height: 100%` fallback before `height: 100dvh`

### Property-Based Tests

- Generate random viewport dimensions and verify the layout container always has non-zero height with the CSS fallback chain
- Generate random platform/OS combinations and verify the tile style URL is always CARTO Positron
- Generate random sequences of map interactions (flyTo, resize, marker add) and verify they work identically before and after the fix

### Integration Tests

- Test full app load in simulated iOS PWA context — map should render with visible tiles
- Test app load on simulated iOS 15 — layout container should have non-zero height
- Test planner sidebar open/close cycle — map should resize correctly after fix
