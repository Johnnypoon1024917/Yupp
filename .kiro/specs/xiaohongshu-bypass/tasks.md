# Implementation Plan: Xiaohongshu Extraction Bypass

## Overview

Add a Xiaohongshu-specific extraction path to `src/actions/scrapeUrl.ts`. Changes are scoped to making `detectLoginWall` platform-aware, adding `extractXiaohongshuData`, and routing Xiaohongshu URLs through the specialized extractor before the generic pipeline. All modifications are in a single file with no new dependencies.

## Tasks

- [ ] 1. Make `detectLoginWall` platform-aware
  - [ ] 1.1 Update `detectLoginWall` signature to accept optional `platform` parameter
    - Change signature from `detectLoginWall(page: Page)` to `detectLoginWall(page: Page, platform?: Platform)`
    - When `platform` is `'xiaohongshu'`, return `false` immediately without inspecting the DOM
    - For all other platform values (including `undefined`), run the existing login wall logic unchanged
    - Import `Platform` type from `@/types` if not already imported
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 1.2 Update `scrapeUrl` to resolve platform before login wall detection
    - Move the `detectPlatform(url)` call to before the `detectLoginWall` call
    - Pass the resolved `platform` as the second argument to `detectLoginWall(page, platform)`
    - _Requirements: 1.4, 1.5_

  - [ ]* 1.3 Write property test for platform-aware login wall detection
    - **Property 1: Platform-aware login wall detection**
    - Generate random login-wall HTML scenarios × random platform values using fast-check
    - Assert `detectLoginWall` returns `false` for `'xiaohongshu'` and the correct heuristic result for all other platforms
    - Follow existing JSDOM mock page pattern from `scrapeUrl.pbt.test.ts`
    - **Validates: Requirements 1.1, 1.2**

- [ ] 2. Implement `extractXiaohongshuData` function
  - [ ] 2.1 Create `extractXiaohongshuData` function with `__INITIAL_STATE__` extraction
    - Add exported async function `extractXiaohongshuData(page: Page): Promise<{ title: string; description: string; imageUrl: string } | null>`
    - Use `page.evaluate()` to access `window.__INITIAL_STATE__.note.noteDetailMap`
    - Take the first entry's `note` object, read `title`, `desc`, and `imageList[0].urlDefault` (or `url`)
    - Wrap the entire evaluate callback in try/catch so malformed data never throws
    - _Requirements: 2.1, 2.4, 2.5_

  - [ ] 2.2 Add DOM selector fallback to `extractXiaohongshuData`
    - When `__INITIAL_STATE__` is absent, empty, or malformed, fall back to DOM selectors
    - Query `#detail-title` for title, `#detail-desc` for description, `.note-scroller img` for first image `src`
    - If all three fields are present, return the object; if any field is missing, return `null`
    - If both strategies fail, return `null`
    - _Requirements: 2.2, 2.3, 4.2, 4.3_

  - [ ]* 2.3 Write property test for `__INITIAL_STATE__` extraction correctness
    - **Property 2: `__INITIAL_STATE__` extraction correctness**
    - Generate random valid `__INITIAL_STATE__` objects with random titles, descriptions, and image URLs
    - Inject into JSDOM mock page via `<script>` tag
    - Assert extracted values match the generated input
    - **Validates: Requirements 2.1**

  - [ ]* 2.4 Write property test for DOM fallback when `__INITIAL_STATE__` is unavailable
    - **Property 3: DOM fallback when `__INITIAL_STATE__` is unavailable or malformed**
    - Generate pages with absent/malformed `__INITIAL_STATE__` + complete DOM selector content
    - Assert extraction returns DOM values without throwing
    - **Validates: Requirements 2.2, 2.5, 4.2**

  - [ ]* 2.5 Write property test for partial DOM data returning null
    - **Property 4: Partial DOM data returns null**
    - Generate pages with absent `__INITIAL_STATE__` and random subsets of DOM selectors (at least one missing)
    - Assert `extractXiaohongshuData` returns `null`
    - **Validates: Requirements 2.3, 4.3**

- [ ] 3. Checkpoint - Verify core extraction logic
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Route Xiaohongshu URLs through specialized extractor in `scrapeUrl`
  - [ ] 4.1 Add Xiaohongshu routing logic to `scrapeUrl`
    - After login wall check, if `platform === 'xiaohongshu'`, call `extractXiaohongshuData(page)` inside a try/catch
    - If result is non-null, use its `title`, `description`, and `imageUrl` directly, bypassing the generic extractor
    - If result is `null` or throws, fall through to the existing generic extraction pipeline
    - For non-Xiaohongshu platforms, use the generic pipeline as before
    - Pass the resolved description (from either path) to `extractPlacesWithAI`
    - Include the correct `platform` value in the returned `ScrapeResult`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.4_

  - [ ]* 4.2 Write unit tests for Xiaohongshu routing in `scrapeUrl`
    - Test that `scrapeUrl` with a Xiaohongshu URL calls `extractXiaohongshuData` before generic extractors
    - Test that non-null XHS result bypasses generic pipeline
    - Test fallback to generic pipeline when XHS extractor returns `null`
    - Test that non-Xiaohongshu URLs do not call `extractXiaohongshuData`
    - Test that exceptions from `extractXiaohongshuData` are caught and fall back gracefully
    - Test that description from either path is passed to `extractPlacesWithAI`
    - Test that `platform` is correctly set in `ScrapeResult`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1_

- [ ] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All changes are scoped to `src/actions/scrapeUrl.ts` and its test files
- Property tests follow the existing JSDOM mock page pattern in `src/actions/__tests__/scrapeUrl.pbt.test.ts`
- Unit tests extend the existing mock-based pattern in `src/actions/__tests__/scrapeUrl.test.ts`
- The `Platform` type already includes `'xiaohongshu'` in `src/types/index.ts`
