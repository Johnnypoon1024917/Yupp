# Implementation Plan: UX Redesign V1

## Overview

This plan implements a comprehensive UX overhaul of the Yupp social-travel PWA. The approach is foundation-first: design tokens are established in `tailwind.config.ts` and `globals.css`, then consumed by each component surface. Utility modules (motion, haptics) are built early so downstream components can import them. Each surface is migrated and enhanced incrementally, with wiring and integration as the final step.

## Tasks

- [x] 1. Design Token System — Colors, Radius, Type Scale, Elevation
  - [x] 1.1 Extend `tailwind.config.ts` with brand palette colors, radius scale, type scale, and elevation scale
    - Add all named colors under `theme.extend.colors`: brand, brand-soft, brand-ink, surface, surface-raised, surface-sunken, ink-1, ink-2, ink-3, border, border-strong, success, warning, danger, and retain accent as alias to brand
    - Add five `borderRadius` tokens: chip 8px, control 12px, card 16px, sheet 24px, pill 9999px
    - Add six `fontSize` entries: display, title, headline, body, caption, micro with lineHeight, letterSpacing, fontWeight
    - Add five `boxShadow` entries: elev-0, elev-1, elev-2, elev-3, elev-modal
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1_

  - [x] 1.2 Create Tailwind plugin for category gradient utility classes
    - Register plugin in `tailwind.config.ts` that provides `bg-cat-food`, `bg-cat-stay`, `bg-cat-see`, `bg-cat-shop`, `bg-cat-default` mapping to gradients from `src/utils/categories.ts`
    - _Requirements: 1.3_

  - [x] 1.3 Emit CSS custom properties on `:root` in `src/app/globals.css`
    - Add `--color-{token-name}` for every palette color on the `:root` selector
    - Update existing CSS variables to align with new token names
    - _Requirements: 1.4_

  - [ ]* 1.4 Write unit tests for design token system
    - Verify tailwind config exports expected color, radius, fontSize, and boxShadow keys
    - Verify CSS custom properties are present in globals.css
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 3.1, 4.1_

- [x] 2. Motion System and Haptics Utility
  - [x] 2.1 Create `src/utils/motion.ts` with duration constants, easing definitions, and framer-motion presets
    - Export DURATION_FAST (0.15s), DURATION_BASE (0.25s), DURATION_SLOW (0.4s)
    - Export EASE_OUT, EASE_IN, EASE_SPRING definitions
    - Export reusable presets: fadeIn, slideUp, scaleIn
    - Export `getReducedMotion()` helper and `reducedTransition` object
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x] 2.2 Create `src/utils/haptics.ts` with tap, success, and error vibration functions
    - Export `haptics` object with `tap()`, `success()`, `error()` methods
    - Gate all vibration calls on `prefers-reduced-motion` using `getReducedMotion()` from motion.ts
    - Handle SSR safety with `typeof navigator` check
    - _Requirements: 15.1, 15.8_

  - [ ]* 2.3 Write unit tests for motion.ts and haptics.ts
    - Test duration/easing exports, reduced motion detection, and haptics suppression
    - _Requirements: 5.1, 5.2, 5.5, 15.1, 15.8_

- [x] 3. Checkpoint — Verify foundation layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Undo Toast System
  - [x] 4.1 Extend `src/store/useToastStore.ts` with undo toast variant and `addUndoToast` method
    - Add `'undo'` to `ToastVariant` union type
    - Add `onUndo` and `undoTimeoutId` optional fields to `Toast` interface
    - Implement `addUndoToast(message, onUndo)` with 5-second auto-dismiss timer
    - On "Undo" tap: invoke callback, clear timer, dismiss toast
    - On timer expiry: dismiss toast, allow deferred operation to commit
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 4.2 Add localStorage persistence for pending delete queue in `useToastStore.ts`
    - Store pending deletes as JSON array under `pending-deletes` key with pinId, pinSnapshot, timestamp
    - On app load, commit any entries older than 5 seconds (cloud delete)
    - On undo, remove entry from localStorage queue
    - _Requirements: 12.7_

  - [x] 4.3 Update `src/components/ToastContainer.tsx` to render undo toast variant
    - Add `'undo'` variant style with `bg-surface-sunken text-ink-1` and `shadow-elev-2`
    - Render "Undo" action button on the right side for undo variant toasts
    - Add 5-second progress bar animation at the bottom of undo toasts
    - Wire button click to `toast.onUndo` callback and `removeToast`
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 4.4 Write unit tests for undo toast store and ToastContainer
    - Test addUndoToast creates toast with correct variant and timer
    - Test undo callback invocation and timer cleanup
    - Test localStorage queue persistence and commit-on-load behavior
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.7_

- [x] 5. PinImage Component and Image Configuration
  - [x] 5.1 Create `src/components/PinImage.tsx` with aspect-ratio reservation, deterministic gradient placeholder, fade-in, and error fallback
    - Accept props: src, alt, pinId, aspectRatio (default "4/5"), className, sizes
    - Reserve space with CSS `aspect-ratio` property to prevent layout shift
    - Generate deterministic gradient from pinId via hash → hue mapping
    - Fade image in over DURATION_BASE (0.25s) on load using CSS opacity transition
    - On error, display gradient placeholder with centered MapPin icon
    - Use `next/image` for optimized loading
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 5.2 Update `next.config.mjs` with `remotePatterns` for social platform CDN domains
    - Add image remote patterns for cdninstagram.com, xiaohongshu.com, douyinpic.com, tiktokcdn.com, tiktokcdn-us.com
    - _Requirements: 14.5_

  - [x] 5.3 Create `public/placeholder-pin.svg` fallback image
    - Create a simple map-pin SVG using brand token colors for use as the default pin placeholder
    - _Requirements: 13.6_

  - [ ]* 5.4 Write unit tests for PinImage component
    - Test deterministic gradient generation produces consistent output for same pinId
    - Test error fallback rendering
    - Test aspect-ratio reservation
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 6. Illustrated Empty States
  - [x] 6.1 Create shared `EmptyState` wrapper component and SVG illustrations
    - Create `src/components/empty-states/EmptyState.tsx` with illustration, message, ctaLabel, onCtaClick props
    - Create `src/components/empty-states/illustrations/MapIllustration.tsx` (Home Surface)
    - Create `src/components/empty-states/illustrations/CompassIllustration.tsx` (DiscoverFeed)
    - Create `src/components/empty-states/illustrations/CalendarIllustration.tsx` (TripTimeline)
    - Create `src/components/empty-states/illustrations/PinIllustration.tsx` (LibraryPane)
    - All SVGs use `var(--color-brand)`, `var(--color-brand-soft)`, `var(--color-ink-3)` for fills and strokes
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 7. Checkpoint — Verify shared components and utilities
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. BottomNav Redesign
  - [x] 8.1 Redesign `src/components/BottomNav.tsx` with icon+label tabs, animated pill highlight, and token migration
    - Render each tab as icon + text label using `text-caption` token
    - Add pill-shaped highlight behind active tab with `bg-brand-soft` and `rounded-pill`
    - Animate pill to new tab position using framer-motion `layoutId="nav-pill"` shared layout
    - Set `aria-current="page"` on active tab button
    - Replace `prefers-reduced-motion` layoutId slide with instant cross-fade
    - Migrate all inline color, radius, and shadow values to design token classes
    - Replace `rounded-t-[32px]` with `rounded-t-sheet`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 16.6_

  - [ ]* 8.2 Write unit tests for BottomNav
    - Test aria-current is set on active tab
    - Test all tabs render icon and label
    - _Requirements: 6.1, 6.4_

- [x] 9. MagicBar Empty-State and Platform Chips
  - [x] 9.1 Create `src/components/MagicBar.demoUrls.ts` with demo URL record
    - Export `DEMO_URLS` record mapping Instagram, Xiaohongshu, Douyin, TikTok to demo URL strings
    - _Requirements: 7.4_

  - [x] 9.2 Add platform chips, cycling placeholder, and dead code removal to `src/components/MagicBar.tsx`
    - When state is idle and input is empty, render 4 Platform Chips below the input field
    - Tapping a chip calls `processUrl(DEMO_URLS[platform], true)`
    - Cycle placeholder text through platform-specific phrases at 3-second intervals using useEffect + setInterval
    - Remove dead `needs_input` clarification code path if present
    - Refactor inline spring configs and animation durations to use imports from `src/utils/motion.ts`
    - Add `Haptics_Utility.tap()` call on chip tap, `success()` on pin created, `error()` on scrape/geocode failure
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 5.4, 15.3, 15.5, 15.7_

  - [ ]* 9.3 Write unit tests for MagicBar platform chips and placeholder cycling
    - Test platform chips render when idle and input is empty
    - Test placeholder text cycling at 3-second intervals
    - _Requirements: 7.1, 7.3_

- [x] 10. Home Surface — Trip Cards and Recent Pins
  - [x] 10.1 Extend `src/types/index.ts` with new Pin fields for PlaceSheet information density
    - Add optional `openingHours?: string[]`, `priceLevel?: number`, `images?: string[]` fields to Pin interface
    - _Requirements: 9.1, 9.2, 9.4_

  - [x] 10.2 Implement Home Surface with Trip Cards strip and Recent Pins strip in `src/components/AppLayout.tsx`
    - Add horizontally scrollable Trip Cards strip sourced from `usePlannerStore.itineraries`, showing cover image, trip name, date, pin count
    - Tap on Trip Card navigates to planner with that itinerary loaded
    - Add horizontally scrollable Recent Pins strip showing 12 most recent pins as 88×88 PinImage thumbnails from `useTravelPinStore.pins` sorted by createdAt desc
    - Tap on thumbnail sets activePinId and opens PlaceSheet
    - Hide both strips when any vaul drawer is open
    - Source all data from existing stores — no new data-fetching logic
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 10.3 Integrate Home Surface empty state illustration
    - When zero pins and zero itineraries, display MapIllustration empty state with CTA that focuses MagicBar
    - _Requirements: 13.1_

  - [ ]* 10.4 Write unit tests for Home Surface
    - Test Trip Cards render from store data
    - Test Recent Pins strip limits to 12 items
    - Test strips are hidden when a drawer is open
    - _Requirements: 8.1, 8.3, 8.5_

- [x] 11. Checkpoint — Verify BottomNav, MagicBar, and Home Surface
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. PlaceSheet Information Density
  - [x] 12.1 Add opening hours collapsible, price level indicator, and open/closed chip to `src/components/PlaceSheet.tsx`
    - Display opening hours in a collapsible section below the address when pin has `openingHours` data
    - Display price-level indicator ("$" repeated priceLevel times) next to the place type badge
    - Display open/closed status chip using `bg-success/10 text-success` for open and `bg-danger/10 text-danger` for closed, computed from openingHours + current time
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 12.2 Add photo carousel to PlaceSheet hero area
    - When pin has multiple images, render a horizontally swipeable photo carousel using CSS `scroll-snap-type: x mandatory`
    - Use PinImage component for each carousel image
    - _Requirements: 9.4_

  - [x] 12.3 Migrate PlaceSheet removal to undo toast pattern and add sticky bottom action row
    - Replace `window.confirm` in `handleRemove` with optimistic removal + `addUndoToast` with deferred cloud delete
    - Add sticky bottom action row with "View Source" and "Open in Google Maps" buttons using `bg-surface` and `shadow-elev-2`
    - When `isEditing === true`, set vaul `dismissible={false}` to prevent drag-dismiss
    - _Requirements: 9.5, 9.6, 9.8, 12.5_

  - [x] 12.4 Migrate PlaceSheet inline styles to design token classes
    - Replace all inline `text-[Npx]`, `rounded-[Npx]`, `shadow-[...]`, and hardcoded color hex values with corresponding token utility classes
    - _Requirements: 9.7, 17.2_

  - [ ]* 12.5 Write unit tests for PlaceSheet enhancements
    - Test open/closed chip renders correctly based on openingHours
    - Test price level indicator renders correct number of "$" symbols
    - Test undo toast is triggered on remove instead of window.confirm
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

- [x] 13. DiscoverFeed Search, Filter, Sort, and Multi-Select
  - [x] 13.1 Add search bar, category filter chips, and sort menu to `src/components/DiscoverFeed.tsx`
    - Add sticky search bar at top that filters pins by title and address as user types
    - Add horizontally scrollable category filter chips below search bar
    - Add sort menu with three options: recently added, highest rated, alphabetical
    - Extract pure filtering/sorting functions: `filterPinsByQuery`, `filterPinsByCategory`, `sortPins` for testability
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 13.2 Implement multi-select mode with bulk actions in DiscoverFeed
    - Long-press (500ms pointerdown) enters multi-select mode with check overlay on selected cards
    - Bulk action bar at bottom with "Delete" and "Move to Collection" buttons
    - Bulk delete uses undo toast pattern with optimistic removal
    - Add `Haptics_Utility.tap()` on multi-select toggle
    - Support Space/Enter to toggle selection, Escape to exit multi-select mode
    - _Requirements: 10.4, 10.5, 10.6, 12.6, 15.4, 16.3_

  - [x] 13.3 Add skeleton loading cards and empty state to DiscoverFeed
    - Display skeleton placeholder cards matching grid layout while loading
    - Display CompassIllustration empty state with CTA when zero pins
    - _Requirements: 10.7, 13.2_

  - [x] 13.4 Ensure DiscoverFeed filter chips and sort menu are keyboard navigable
    - Make sort menu and category filter chips fully Tab-navigable
    - Add appropriate ARIA roles (role="listbox", role="option") for sort menu
    - _Requirements: 16.3, 16.4_

  - [ ]* 13.5 Write unit tests for DiscoverFeed filtering, sorting, and multi-select
    - Test filterPinsByQuery returns correct results for title and address matches
    - Test sortPins orders correctly for each sort mode
    - Test multi-select mode toggling and bulk delete flow
    - _Requirements: 10.1, 10.3, 10.4, 10.6_

- [x] 14. Checkpoint — Verify PlaceSheet and DiscoverFeed
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. DayContainer Metadata Header and Weather
  - [x] 15.1 Create `src/hooks/useWeather.ts` hook and weather code mapping utility
    - Implement `useWeather(lat, lng, targetDate)` hook that fetches from Open-Meteo `/v1/forecast` endpoint
    - Check if targetDate is within 7-day window; return null if outside
    - Return `{ tempHigh, tempLow, weatherCode, icon }` on success, null on error (silent failure)
    - Implement `weatherCodeToIcon(code)` pure function mapping WMO codes to emoji icons
    - _Requirements: 11.4, 11.5_

  - [x] 15.2 Implement dominant city extraction utility
    - Create `getDominantCity(pins)` pure function that groups pins by city extracted from address and returns the city with the most pins
    - _Requirements: 11.2_

  - [x] 15.3 Redesign `src/components/planner/DayContainer.tsx` with metadata header
    - Display day number and formatted date (e.g., "Mon, Jun 16") computed from tripDate + dayNumber
    - Display dominant city name from pin addresses
    - Display stop count (pins.length) and total estimated distance from useDistanceMatrix
    - Display weather chip with temperature and condition icon when within forecast window
    - Make header sticky at top of scroll container
    - Add inline rename mode on day title tap (contentEditable or input swap)
    - Add `Haptics_Utility.success()` call when user saves a day
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 15.6_

  - [x] 15.4 Migrate DayContainer inline styles to design token classes
    - Replace all inline color, radius, shadow, and typography values with corresponding token utility classes
    - _Requirements: 11.8, 17.2_

  - [ ]* 15.5 Write unit tests for useWeather hook and DayContainer utilities
    - Test weatherCodeToIcon mapping for all WMO code ranges
    - Test getDominantCity returns correct city for mixed-address pins
    - Test useWeather returns null for dates outside 7-day window
    - _Requirements: 11.2, 11.4, 11.5_

- [x] 16. Planner Empty States
  - [x] 16.1 Integrate empty state illustrations into TripTimeline and LibraryPane
    - When TripTimeline has zero planned pins, display CalendarIllustration empty state with CTA that opens LibraryPane
    - When LibraryPane has zero unplanned pins, display PinIllustration empty state with descriptive message
    - _Requirements: 13.3, 13.4_

- [x] 17. Accessibility and Keyboard Support
  - [x] 17.1 Add global focus ring style and sr-only labels across all components
    - Add `:focus-visible` rule in `globals.css` with 2px solid brand color and 2px offset
    - Audit all icon-only buttons and add descriptive `aria-label` attributes
    - Add `sr-only` labels for icon-only controls and decorative elements
    - Add `aria-hidden="true"` to all decorative SVGs
    - Ensure all interactive controls use semantic `<button>` or `<a>` elements
    - _Requirements: 16.1, 16.2, 16.5_

  - [x] 17.2 Add haptic feedback calls to MapView marker tap
    - Call `Haptics_Utility.tap()` when user taps a pin marker on the map
    - _Requirements: 15.2_

- [x] 18. Migration — Radius tokens for drawer components
  - [x] 18.1 Migrate PlaceSheet, ProfileSheet, DiscoverFeed, and PlannerSidebar to use `rounded-sheet` token
    - Replace any `rounded-[32px]` or similar inline rounding with `rounded-sheet` on top-level drawer elements
    - Verify each component uses design token classes end-to-end
    - _Requirements: 2.2, 2.3, 17.2_

- [x] 19. Checkpoint — Verify DayContainer, accessibility, and migration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Final integration and backwards compatibility verification
  - [x] 20.1 Verify accent alias and backwards compatibility
    - Confirm `accent` color alias resolves to `brand` value (#FF5A4E) in tailwind config
    - Confirm existing `text-accent`, `bg-accent`, `border-accent` classes still work
    - Verify components not listed in requirements are visually and functionally unchanged
    - Run full existing test suite to confirm no regressions
    - _Requirements: 17.1, 17.3, 17.4, 17.5, 17.6_

- [x] 21. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major phase
- The design token foundation (tasks 1-3) must be completed first as all subsequent tasks depend on it
- The undo toast system (task 4) must be completed before PlaceSheet and DiscoverFeed migrations that consume it
- PinImage (task 5) must be completed before Home Surface and PlaceSheet carousel tasks that use it
- No new runtime dependencies are introduced beyond the Open-Meteo API fetch for weather data
