# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - iOS PWA Blank Map
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the three independent failure modes
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases for each root cause
  - Create test file `src/components/__tests__/ios-pwa-blank-map.bugcondition.test.ts` using Vitest + fast-check
  - Test 1a — Tile Provider: Assert `TILE_STYLE` in `src/components/MapView.tsx` equals `'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'` (from Bug Condition: `tileProvider == 'stadiamaps'`). Will fail — currently points to Stadia Maps.
  - Test 1b — Post-Init Resize: Read `MapView.tsx` source and assert that the map init `useEffect` contains a `setTimeout` call with `map.resize()` after `mapRef.current = map` (from Bug Condition: `canvasWidth == 0 AND canvasHeight == 0`). Will fail — no such call exists.
  - Test 1c — AppLayout Height Fallback: Read `AppLayout.tsx` source and assert the root div className includes both `h-screen` and `h-[100dvh]` (from Bug Condition: `NOT cssSupports('100dvh')`). Will fail — only `h-[100dvh]` present.
  - Test 1d — Body CSS Fallback: Read `src/app/globals.css` and assert the body rule contains `height: 100%` before `height: 100dvh` (from Bug Condition: `NOT cssSupports('100dvh')`). Will fail — only `100dvh` present.
  - PBT property: For all generated platform/OS combinations where `isBugCondition` returns true, assert the source code contains the expected fix patterns
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g., "TILE_STYLE equals Stadia URL", "no setTimeout resize call", "missing h-screen class", "missing height: 100% fallback")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-iOS and Standard Browser Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Create test file `src/components/__tests__/ios-pwa-blank-map.preservation.test.ts` using Vitest + fast-check
  - Observe on UNFIXED code: MapView renders with `position: absolute`, `inset: 0`, `width: 100%`, `height: 100%` inline styles
  - Observe on UNFIXED code: MapView accepts `className` prop and applies it to the container div
  - Observe on UNFIXED code: AppLayout root div has `relative`, `w-screen`, `overflow-hidden`, `overscroll-none`, `bg-[#FAFAFA]` classes
  - Observe on UNFIXED code: `globals.css` body has `overflow: hidden`, `position: fixed`, `width: 100vw`, `overscroll-behavior: none`, `touch-action: none`
  - Observe on UNFIXED code: MapView `shouldHideLayer` filters POI layers with keywords `['poi', 'label', 'icon', 'place', 'text']`
  - Observe on UNFIXED code: MapView exposes `flyToPin`, `resize`, `disableInteractions`, `enableInteractions` via ref
  - PBT Property 2a: For all random viewport dimension strings, the AppLayout root div always contains `w-screen`, `overflow-hidden`, `overscroll-none` classes (non-iOS layout structure preserved)
  - PBT Property 2b: For all random layer ID strings, `shouldHideLayer` returns true iff the ID contains one of the POI filter keywords (marker/interaction behavior preserved)
  - PBT Property 2c: For all random strings, the MapView inline styles always include `position: 'absolute'`, `width: '100%'`, `height: '100%'` (map container sizing preserved)
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for iOS PWA blank map rendering

  - [x] 3.1 Swap tile provider in MapView.tsx
    - Change `TILE_STYLE` from `'https://tiles.stadiamaps.com/styles/alidade_smooth.json'` to `'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'`
    - CARTO Positron provides a similar clean, light style without Origin header enforcement
    - _Bug_Condition: isBugCondition(input) where input.isPWA AND input.platform == 'iOS' AND tileProvider == 'stadiamaps'_
    - _Expected_Behavior: result.tileStyleURL == 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'_
    - _Preservation: Desktop and Android map rendering unchanged — CARTO Positron is visually similar to Stadia Alidade Smooth_
    - _Requirements: 1.1, 2.1, 3.1, 3.2_

  - [x] 3.2 Add post-init resize in MapView.tsx
    - In the map initialization `useEffect`, after `mapRef.current = map;`, add `setTimeout(() => map.resize(), 100);`
    - This gives iOS WebKit time to complete DOM paint before MapLibre recalculates canvas dimensions
    - _Bug_Condition: isBugCondition(input) where input.platform == 'iOS' AND mapContainer.canvasWidth == 0_
    - _Expected_Behavior: result.resizeCalledAfterInit == true AND canvas dimensions > 0_
    - _Preservation: On desktop/Android, resize is a no-op when canvas is already correctly sized_
    - _Requirements: 1.2, 2.2, 3.4, 3.5_

  - [x] 3.3 Add h-screen fallback in AppLayout.tsx
    - Change root div className from `h-[100dvh]` to `h-screen h-[100dvh]`
    - `h-screen` (100vh) provides fallback; `h-[100dvh]` overrides on browsers supporting `dvh`
    - _Bug_Condition: isBugCondition(input) where input.osVersion < 16 AND NOT cssSupports('100dvh')_
    - _Expected_Behavior: result.containerHeight > 0 for all iOS versions_
    - _Preservation: On iOS 16+ and all desktop/Android, h-[100dvh] overrides h-screen — no visual change_
    - _Requirements: 1.3, 2.3, 3.3_

  - [x] 3.4 Add height: 100% fallback in globals.css
    - Add `height: 100%;` immediately before the existing `height: 100dvh;` in the body rule
    - Browsers supporting `dvh` use the later declaration; older browsers use `100%`
    - _Bug_Condition: isBugCondition(input) where input.osVersion < 16 AND NOT cssSupports('100dvh')_
    - _Expected_Behavior: result.bodyHeight > 0 for all iOS versions_
    - _Preservation: On browsers with dvh support, 100dvh overrides 100% — no visual change_
    - _Requirements: 1.4, 2.4, 3.3_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - iOS PWA Blank Map
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior for all four fix areas
    - When this test passes, it confirms: CARTO tile URL is set, resize delay exists, h-screen fallback present, height: 100% fallback present
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-iOS and Standard Browser Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation properties still hold: layout classes, POI filtering, inline styles, map ref API unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite with `npm test`
  - Ensure all bug condition tests pass (confirming the fix)
  - Ensure all preservation tests pass (confirming no regressions)
  - Ensure no other existing tests are broken
  - Ask the user if questions arise
