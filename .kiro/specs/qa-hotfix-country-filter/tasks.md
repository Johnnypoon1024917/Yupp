# Implementation Plan: QA Hotfix & Country Filter

## Overview

This plan implements three concern areas in order: clipboard behaviour overhaul (remove auto-polling, add explicit paste button), PlaceSheet polish (CSS fix + Enter-to-save), and the new Country grouping feature (utility + SavedLibrary + LibraryPane). Each task builds incrementally so there is no orphaned code.

## Tasks

- [x] 1. Remove automatic clipboard polling from AppLayout
  - [x] 1.1 Strip clipboard-related code from AppLayout
    - Delete the `useEffect` block that binds `window.addEventListener('focus', handleFocus)` for clipboard detection
    - Remove `bannerUrl` / `bannerPlatform` state declarations and all setter calls
    - Remove `processedLinksRef` ref declaration
    - Remove the `LinkBanner` import and its JSX rendering block (the `{bannerUrl && <LinkBanner ... />}` section)
    - Remove imports of `extractSupportedUrl`, `formatPlatformName` from `@/utils/urlParsing`
    - Remove import of `detectPlatform` from `@/actions/extractPlaces`
    - Preserve all other functionality: `autoPaste` query param, DndContext, MapView, MagicBar, BottomNav, PlaceSheet, ProfileSheet, DiscoverFeed, CollectionDrawer, PlannerSidebar, AuthModal, resize useEffect, cloud sync hook
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Add explicit Paste & Scan button to MagicBar
  - [x] 2.1 Implement handlePaste callback and Clipboard icon button
    - Import `Clipboard` from `lucide-react`
    - Add `handlePaste` async callback that reads `navigator.clipboard.readText()`, trims the result, validates with `isValidUrl`, and calls `processUrl(trimmed, true)` only for valid URLs
    - Silently catch errors from clipboard API (permission denied, unavailable)
    - Render a `<button type="button">` with `<Clipboard size={16} />` adjacent to the text input inside the form, with `aria-label="Paste from clipboard"`
    - Hide the paste button when `showStatusText` is true (processing/success states)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x]* 2.2 Write property test for Paste button URL validation gate
    - **Property 1: Paste button URL validation gate**
    - Generate random strings (valid URLs and non-URLs) with fast-check; assert `processUrl` is called if and only if the string passes `isValidUrl` after trimming
    - Test file: `src/components/__tests__/MagicBar.pbt.test.ts`
    - **Validates: Requirements 2.3, 2.4**

- [x] 3. Checkpoint — Clipboard overhaul
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Fix PlaceSheet collection dropdown CSS and Enter-to-save
  - [x] 4.1 Fix collection dropdown CSS clipping
    - On the collection dropdown outer wrapper `div` (the absolutely-positioned one with `overflow-hidden`), change `overflow-hidden` → `overflow-visible`
    - Wrap the `collections.map(...)` button list in an inner `div` with `rounded-b-lg overflow-hidden` to maintain rounded corners on the scrollable list
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.2 Add Enter key to save edited pin title
    - Add `onKeyDown` handler to the `editTitle` input element: `onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); }}`
    - Only the Enter key triggers save; all other keys are ignored
    - _Requirements: 4.1, 4.2, 4.3_

  - [x]* 4.3 Write property test for Non-Enter keys do not trigger save
    - **Property 2: Non-Enter keys do not trigger save**
    - Generate random key names (excluding "Enter") with fast-check; assert `handleSaveEdit` is never called
    - Test file: `src/components/__tests__/PlaceSheet.pbt.test.ts`
    - **Validates: Requirements 4.3**

- [x] 5. Checkpoint — PlaceSheet polish
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create extractCountry utility
  - [x] 6.1 Create `src/utils/address.ts` with extractCountry function
    - Export `extractCountry(address: string | undefined): string`
    - Return trimmed last comma-separated segment for non-empty strings
    - Return the trimmed full string if no commas present
    - Return `"Unknown Country"` for empty string or undefined input
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x]* 6.2 Write property test for extractCountry last comma segment
    - **Property 3: extractCountry returns last comma segment**
    - Generate random non-empty comma-separated strings with fast-check; assert result equals the trimmed last segment
    - Test file: `src/utils/__tests__/address.pbt.test.ts`
    - **Validates: Requirements 5.2, 5.3**

  - [x]* 6.3 Write property test for extractCountry round-trip consistency
    - **Property 4: extractCountry round-trip consistency**
    - Generate random address strings with fast-check; assert `extractCountry(anyPrefix + ', ' + extractCountry(addr)) === extractCountry(addr)`
    - Test file: `src/utils/__tests__/address.pbt.test.ts`
    - **Validates: Requirements 5.5**

- [x] 7. Add Country grouping mode to SavedLibrary
  - [x] 7.1 Implement groupPinsByCountry and three-way toggle in SavedLibrary
    - Import `extractCountry` from `@/utils/address`
    - Add exported `groupPinsByCountry(pins: Pin[]): Record<string, Pin[]>` function using `extractCountry` for keys
    - Widen `groupMode` state type from `'region' | 'category'` to `'region' | 'category' | 'country'`
    - Add a third "Country" button to the segmented toggle UI
    - Add `'country'` branch in the `filteredGroups` useMemo calling `groupPinsByCountry`
    - Ensure search query is preserved when switching modes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x]* 7.2 Write property test for Country grouping keys match extractCountry
    - **Property 5: Country grouping keys match extractCountry**
    - Generate random Pin arrays with fast-check; assert every pin under key `k` satisfies `extractCountry(pin.address) === k` and every input pin appears in exactly one group
    - Test file: `src/components/planner/__tests__/SavedLibrary.pbt.test.ts`
    - **Validates: Requirements 6.2, 7.2**

  - [x]* 7.3 Write property test for SavedLibrary mode switching preserves search query
    - **Property 6: SavedLibrary mode switching preserves search query**
    - Generate random search strings with fast-check; simulate mode switches and assert the search input value is unchanged
    - Test file: `src/components/planner/__tests__/SavedLibrary.pbt.test.ts`
    - **Validates: Requirements 6.5**

- [x] 8. Add Country grouping mode to LibraryPane
  - [x] 8.1 Implement groupPinsByCountry and two-way toggle in LibraryPane
    - Import `extractCountry` from `@/utils/address`
    - Add exported `groupPinsByCountry(pins: Pin[]): Record<string, Pin[]>` function using `extractCountry` for keys
    - Add `groupMode` state: `'city' | 'country'` defaulting to `'city'`
    - Add a City / Country segmented toggle above the search input
    - Branch `filteredGroups` useMemo on `groupMode` to call either `groupPinsByCity` or `groupPinsByCountry`
    - Ensure search query is preserved when switching modes
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x]* 8.2 Write property test for LibraryPane mode switching preserves search query
    - **Property 7: LibraryPane mode switching preserves search query**
    - Generate random search strings with fast-check; simulate mode switches and assert the search input value is unchanged
    - Test file: `src/components/planner/__tests__/LibraryPane.pbt.test.ts`
    - **Validates: Requirements 7.5**

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each concern area
- Property tests validate universal correctness properties from the design document
- All code is TypeScript/React — no new dependencies beyond `lucide-react` (already installed)
