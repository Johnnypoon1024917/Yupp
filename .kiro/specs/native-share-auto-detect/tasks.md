# Implementation Plan: Native Share & Auto-Detect

## Overview

Implement the Native Share & Auto-Detect feature for YUPP Travel PWA. The plan follows a bottom-up approach: first build the pure URL parsing utility (testable in isolation), then the manifest and share handler route, then extend MagicBar with `triggerProcess`, then add clipboard detection and Link Banner in AppLayout. Property-based tests validate correctness properties from the design alongside each implementation step.

## Tasks

- [x] 1. Create URL parsing utility and property tests
  - [x] 1.1 Create `src/utils/urlParsing.ts` with `extractSupportedUrl(text: string): string | null`
    - Use a regex to find HTTP(S) URLs in arbitrary text
    - Validate each candidate URL against `detectPlatform` from `src/actions/extractPlaces.ts`
    - Return the first supported URL found, or `null`
    - Export `detectPlatform` from `extractPlaces.ts` if not already exported (it is currently non-exported)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 1.2 Write property test: URL extraction returns valid supported URL or null
    - **Property 1: URL extraction returns a valid supported URL or null**
    - Generate arbitrary strings with and without embedded supported URLs using fast-check
    - Verify `extractSupportedUrl` returns either `null` or a valid URL with a supported hostname
    - Place test in `src/utils/__tests__/urlParsing.pbt.test.ts`
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ]* 1.3 Write property test: URL extraction round-trip with detectPlatform
    - **Property 2: URL extraction round-trip with detectPlatform**
    - Generate strings containing exactly one supported URL embedded in surrounding text
    - Verify `extractSupportedUrl(text)` → `detectPlatform(result)` returns a Platform other than `'unknown'`
    - Place test in `src/utils/__tests__/urlParsing.pbt.test.ts`
    - **Validates: Requirements 8.4**

  - [ ]* 1.4 Write unit tests for `extractSupportedUrl`
    - Test empty string → null
    - Test string with no URLs → null
    - Test string with one supported URL → returns that URL
    - Test string with multiple supported URLs → returns first
    - Test URLs with subdomains (www.instagram.com, m.xiaohongshu.com)
    - Test URLs embedded in text with newlines, tabs, surrounding words
    - Place test in `src/utils/__tests__/urlParsing.test.ts`
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 2. Register PWA as share target
  - [x] 2.1 Add `share_target` to `public/manifest.json`
    - Add `share_target` object with `action: "/share"`, `method: "GET"`, `params: { title: "title", text: "text", url: "url" }`
    - Preserve all existing manifest properties unchanged
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 2.2 Write smoke test for manifest share_target
    - Read and parse `public/manifest.json`
    - Assert `share_target` has correct structure
    - Assert all original properties (name, icons, display, etc.) are still present
    - Place test in `src/__tests__/manifest-share-target.test.ts`
    - _Requirements: 1.1, 1.3_

- [x] 3. Create share handler route
  - [x] 3.1 Create `src/app/share/page.tsx` as a `'use client'` component
    - Read `url` and `text` from `useSearchParams()`
    - Call `extractSupportedUrl(url)` first; if null, call `extractSupportedUrl(text)`
    - Redirect to `/?autoPaste=<extractedUrl>` using `useRouter().replace()` for client-side redirect
    - If no supported URL found, redirect to `/`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.2 Write property test: Share handler routing correctness
    - **Property 3: Share handler routing correctness**
    - Generate random `url`/`text` param combinations (some with supported URLs, some without)
    - Verify redirect target matches the priority logic: url param first, then text param, then fallback to `/`
    - Place test in `src/app/__tests__/share-handler.pbt.test.ts`
    - **Validates: Requirements 2.2, 2.3, 2.4**

  - [ ]* 3.3 Write unit tests for share handler
    - Test: `url` param with supported URL → redirects to `/?autoPaste=<url>`
    - Test: `url` empty, `text` contains supported URL → extracts and redirects
    - Test: neither param has supported URL → redirects to `/`
    - Test: uses client-side redirect (router.replace)
    - Place test in `src/app/__tests__/share-handler.test.ts`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend MagicBar with `triggerProcess` and shared-link status text
  - [x] 5.1 Add `triggerProcess(url: string)` to `MagicBarRef` in `src/components/MagicBar.tsx`
    - Extend `useImperativeHandle` to expose `triggerProcess`
    - `triggerProcess` sets input value to the URL and invokes the same processing logic as `handleSubmit`
    - Ignore call if `state === 'processing'` (Req 6.3) or URL is empty string (Req 6.4)
    - Accept an optional `isShared` flag (or detect via call source) to differentiate status text
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 5.2 Add shared-link status text logic
    - When processing is triggered via `triggerProcess`, display "Shared from [Platform_Name]! Finding the spot..." using `detectPlatform` + `formatPlatformName`
    - When processing is triggered via manual paste, continue showing "Scanning for multiple spots..."
    - Call `detectPlatform` on the URL before beginning the scrape step
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 5.3 Write property test: Platform name formatting
    - **Property 6: Platform name formatting**
    - Test `formatPlatformName` across all Platform values ('instagram', 'douyin', 'xiaohongshu')
    - Verify first letter is capitalized and rest is preserved
    - Place test in `src/components/__tests__/MagicBar.pbt.test.ts`
    - **Validates: Requirements 5.1, 7.1**

  - [ ]* 5.4 Write unit tests for MagicBar triggerProcess
    - Test: `triggerProcess` sets input and starts processing
    - Test: `triggerProcess` ignored during active processing
    - Test: `triggerProcess('')` ignored
    - Test: status text shows "Shared from [Platform]" for triggerProcess
    - Test: status text shows "Scanning for multiple spots..." for manual paste
    - Place test in `src/components/__tests__/MagicBar.test.ts`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3_

- [x] 6. Create Link Banner component
  - [x] 6.1 Create `src/components/LinkBanner.tsx`
    - Accept props: `url`, `platformName`, `onAccept`, `onDismiss`
    - Render text: "📍 Detected a link from [Platform_Name]. Pin it now?"
    - Include "Yes" button that calls `onAccept`
    - Include dismiss mechanism (X button) that calls `onDismiss`
    - Position at top of viewport below safe area inset, at `z-[35]`
    - Use `framer-motion` for slide-down + fade enter/exit animations
    - Auto-dismiss after 8 seconds via `useEffect` timer with cleanup
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 6.2 Write unit tests for LinkBanner
    - Test: renders correct text with platform name
    - Test: "Yes" button calls `onAccept`
    - Test: dismiss button calls `onDismiss`
    - Test: auto-dismisses after 8 seconds (use fake timers)
    - Place test in `src/components/__tests__/LinkBanner.test.ts`
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrate clipboard detection and autoPaste in AppLayout
  - [x] 8.1 Add `autoPaste` query parameter consumption in `src/components/AppLayout.tsx`
    - Add `useEffect` that reads `autoPaste` from `window.location.search` on mount
    - Call `magicBarRef.current?.triggerProcess(url)` with the extracted URL
    - Remove `autoPaste` param from browser URL via `window.history.replaceState` without page reload
    - Use a ref to ensure processing happens at most once per page load
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 8.2 Add clipboard detection on window focus
    - Add `useEffect` that listens for `focus` event on `window`
    - On focus, call `navigator.clipboard.readText()` wrapped in try/catch (silently ignore errors)
    - Pass clipboard text to `extractSupportedUrl`; if result is non-null and not in `processedLinksRef` Set, show LinkBanner
    - Add URL to `processedLinksRef` Set after displaying the banner
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 8.3 Wire LinkBanner into AppLayout render tree
    - Add state for `bannerUrl` and `bannerPlatform`
    - Render `LinkBanner` conditionally when `bannerUrl` is set
    - `onAccept` calls `magicBarRef.current?.triggerProcess(bannerUrl)` and clears banner
    - `onDismiss` adds URL to processed set and clears banner
    - _Requirements: 5.2, 5.3, 5.5_

  - [ ]* 8.4 Write property test: Clipboard detection shows banner iff supported URL is unprocessed
    - **Property 4: Clipboard detection shows banner iff supported URL is unprocessed**
    - Generate clipboard text and processed link sets
    - Verify banner is shown if and only if `extractSupportedUrl(text)` returns non-null AND URL is not in processed set
    - Place test in `src/components/__tests__/AppLayout.clipboard.pbt.test.ts`
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [ ]* 8.5 Write property test: Processed links deduplication prevents repeat prompts
    - **Property 5: Processed links deduplication prevents repeat prompts**
    - Generate supported URLs, add to processed set, then simulate clipboard detection
    - Verify no banner is shown for already-processed URLs
    - Place test in `src/components/__tests__/AppLayout.clipboard.pbt.test.ts`
    - **Validates: Requirements 4.4, 4.6**

  - [ ]* 8.6 Write unit tests for AppLayout autoPaste and clipboard integration
    - Test: `autoPaste` param triggers `triggerProcess` on mount
    - Test: `autoPaste` param is removed from URL after consumption
    - Test: `autoPaste` processed at most once per page load
    - Test: clipboard read on focus triggers banner for supported URL
    - Test: clipboard read error is silently ignored
    - Test: processed URL does not trigger banner again
    - Place test in `src/components/__tests__/AppLayout.share.test.ts`
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.5, 4.6_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 6 correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The `detectPlatform` function in `src/actions/extractPlaces.ts` needs to be exported for use by `urlParsing.ts`
