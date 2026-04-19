# Implementation Plan: Mobile App Shell

## Overview

Convert the Travel Pin Board from a traditional web layout into a mobile-first App Shell using a layer-cake architecture. The map becomes a permanently fixed full-screen background, and all interactive UI floats above it via fixed-position elements and a vaul-powered bottom sheet. Implementation proceeds bottom-up: CSS viewport lock → store changes → new components → refactoring existing components → wiring in AppLayout → property-based tests.

## Tasks

- [x] 1. Apply viewport lock CSS and update Zustand store
  - [x] 1.1 Apply viewport lock CSS to globals.css
    - Update `html` rule: `overflow: hidden; height: 100%;`
    - Update `body` rule: `height: 100dvh; width: 100vw; overflow: hidden; position: fixed; overscroll-behavior: none; touch-action: none;`
    - Remove any conflicting existing `width: 100%; height: 100%;` on body
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Add activePinId state and setActivePinId action to useTravelPinStore
    - Add `activePinId: string | null` initialized to `null` in state
    - Add `setActivePinId: (pinId: string | null) => void` action
    - Update the `TravelPinStore` interface with both new members
    - Exclude `activePinId` from the `partialize` function (transient UI state)
    - _Requirements: 6.1, 6.2, 6.5_

  - [ ]* 1.3 Write property test: setActivePinId round-trip
    - Create `src/store/__tests__/useTravelPinStore.pbt.test.ts`
    - **Property 1: setActivePinId round-trip**
    - For any `string | null` value generated via `fc.option(fc.string())`, calling `setActivePinId(value)` then reading `getState().activePinId` returns the same value
    - Minimum 100 iterations
    - **Validates: Requirements 6.2**

  - [ ]* 1.4 Write property test: activePinId persistence exclusion
    - In the same test file `src/store/__tests__/useTravelPinStore.pbt.test.ts`
    - **Property 2: activePinId persistence exclusion**
    - For any sequence of `setActivePinId` calls with random `string | null` values, the output of the store's `partialize` function never contains an `activePinId` key
    - Minimum 100 iterations
    - **Validates: Requirements 6.5**

- [x] 2. Checkpoint — Ensure store changes and CSS compile correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create BottomNav component
  - [x] 3.1 Create `src/components/BottomNav.tsx`
    - Client component with `BottomNavProps`: `activeTab: 'discover' | 'add' | 'profile'` and `onTabChange` callback
    - Position: `absolute bottom-6` centered horizontally
    - Glassmorphism: `bg-white/80 backdrop-blur-xl border border-white/20`
    - `rounded-full` pill shape, z-30
    - Three Lucide icons: `Compass` (Discover), `PlusCircle` (Add), `User` (Profile)
    - `PlusCircle` always in accent `#6366F1`; `Compass`/`User` in `#000000` with active state indicator
    - Tapping any icon calls `onTabChange` with the corresponding tab value
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9, 3.10_

  - [ ]* 3.2 Write unit tests for BottomNav
    - Create `src/components/__tests__/BottomNav.test.tsx`
    - Test three icons render, correct colors, pill shape classes, glassmorphism classes
    - Test Discover/Add/Profile tap callbacks fire with correct arguments
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 4. Create PlaceSheet component
  - [x] 4.1 Create `src/components/PlaceSheet.tsx`
    - Client component with `PlaceSheetProps`: `pin: Pin | null` and `onDismiss: () => void`
    - Uses `vaul` Drawer; opens when `pin` is non-null, closed when null
    - Full-bleed hero image, title with `text-2xl tracking-tight`
    - Conditional `primaryType` pill badge and `rating` display
    - "View Source" button with accent `#6366F1` background, opens `pin.sourceUrl` via `window.open`
    - Drag-down dismiss calls `onDismiss`
    - z-index 50
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [ ]* 4.2 Write unit tests for PlaceSheet
    - Create `src/components/__tests__/PlaceSheet.test.tsx`
    - Test sheet opens when pin is non-null, stays closed when null
    - Test primaryType badge shown/hidden, rating shown/hidden
    - Test "View Source" button opens sourceUrl
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.8_

- [x] 5. Refactor MagicBar and MapView
  - [x] 5.1 Refactor MagicBar positioning
    - Change position from `top-4` to `top-12` in the outer container div
    - Add `shadow-xl` to the form element for prominent floating appearance
    - Preserve all existing URL input, processing animation, and clarification UI functionality
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 5.2 Update MapView marker interaction
    - Replace `showMarkerPopover(map, clickedPin)` call with `useTravelPinStore.getState().setActivePinId(clickedPin.id)`
    - Remove import of `showMarkerPopover` from `MarkerPopover`
    - Keep the cinematic `flyTo` animation on marker click
    - Keep `flyTo` animation on new pin creation
    - _Requirements: 7.1, 7.2, 7.3, 6.3_

- [x] 6. Create AppLayout and overhaul page.tsx
  - [x] 6.1 Create `src/components/AppLayout.tsx`
    - Client component establishing layer-cake z-index stacking
    - Renders `MapView` at z-0 (full-screen background)
    - Renders `MagicBar` at z-40
    - Renders `BottomNav` at z-30
    - Renders `PlaceSheet` at z-50
    - Holds `MapViewRef` for resize/flyTo coordination
    - Manages `activeTab` local state for BottomNav
    - Derives `activePin` from `activePinId` + `pins` in store
    - Wires BottomNav Add tap to MagicBar focus
    - Wires PlaceSheet dismiss to `setActivePinId(null)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.7, 3.8, 4.9, 6.4_

  - [x] 6.2 Overhaul `src/app/page.tsx`
    - Replace current inline layout with `<AppLayout />` as sole top-level structure
    - Remove CollectionDrawer usage and related drawer state
    - Remove map container div with transition logic
    - _Requirements: 2.5_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code is TypeScript/React (Next.js) — matching the existing codebase
