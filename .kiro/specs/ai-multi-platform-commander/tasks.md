# Implementation Plan: AI Multi-Platform Commander

## Overview

Transform YUPP's single-location scraping pipeline into a multi-location extraction engine. Implementation proceeds in layers: data model updates → AI extraction module → scraper integration → MagicBar batch orchestration → DnD sensor fix → final wiring and tests.

## Tasks

- [x] 1. Update data models and type definitions
  - [x] 1.1 Add `ExtractedPlace` interface and `Platform` type to `src/types/index.ts`
    - Add `ExtractedPlace` with `name: string` and `contextualHints: string[]`
    - Add `Platform` type as `'instagram' | 'douyin' | 'xiaohongshu' | 'unknown'`
    - _Requirements: 1.1_
  - [x] 1.2 Update `ScrapeResult` interface in `src/types/index.ts`
    - Replace `location: string` and `contextualHints: string[]` with `extractedPlaces: ExtractedPlace[]`
    - Add `platform: Platform` field
    - Retain `title`, `description`, `imageUrl`, `sourceUrl` fields
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Implement AI extraction module `src/actions/extractPlaces.ts`
  - [x] 2.1 Create `detectPlatform` function
    - Map `instagram.com` → `'instagram'`, `v.douyin.com` → `'douyin'`, `xiaohongshu.com` / `xhslink.com` → `'xiaohongshu'`, anything else → `'unknown'`
    - Parse hostname from URL string
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 2.2 Write property test for platform detection
    - **Property 1: Platform detection correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
  - [x] 2.3 Create `buildExtractionPrompt` function
    - Use the prompt template: "Extract all restaurants, attractions, or points of interest from this social media caption. Return ONLY a valid JSON array of objects..."
    - Append the caption text after the template
    - _Requirements: 6.1, 6.2_
  - [ ]* 2.4 Write property test for prompt construction
    - **Property 2: Extraction prompt contains template and caption**
    - **Validates: Requirements 3.3, 6.1, 6.2**
  - [x] 2.5 Create `parseLLMResponse` function
    - Strip markdown code fences if present before parsing
    - Validate parsed JSON is an array
    - Filter out elements missing a string `name` field
    - Return empty array for invalid/non-array responses
    - _Requirements: 3.4, 3.5, 4.4, 6.3, 6.4, 6.5_
  - [ ]* 2.6 Write property test for LLM response parsing round-trip
    - **Property 3: LLM response parsing round-trip**
    - **Validates: Requirements 3.4, 4.4, 6.3**
  - [ ]* 2.7 Write property test for invalid LLM response rejection
    - **Property 4: Invalid LLM responses are rejected**
    - **Validates: Requirements 3.5, 6.4**
  - [ ]* 2.8 Write property test for invalid element filtering
    - **Property 5: Invalid elements are filtered from parsed arrays**
    - **Validates: Requirements 6.5**
  - [x] 2.9 Implement `callDeepSeek` internal function
    - Use OpenAI-compatible API at `https://api.deepseek.com`
    - Authenticate with `DEEPSEEK_API_KEY` env var
    - Enforce 10-second timeout with `AbortController`
    - Skip call if `DEEPSEEK_API_KEY` is not set
    - _Requirements: 3.1, 3.2, 5.1, 5.2, 10.1, 10.3_
  - [x] 2.10 Implement `callGemini` internal function
    - Use `@google/generative-ai` SDK
    - Authenticate with `GEMINI_API_KEY` env var
    - Enforce 10-second timeout with `AbortController`
    - Skip call if `GEMINI_API_KEY` is not set
    - _Requirements: 4.1, 4.2, 5.1, 10.2, 10.4_
  - [x] 2.11 Implement `extractPlacesWithAI` orchestrator function
    - Execute fallback chain: DeepSeek → Gemini → og:title
    - Call `buildExtractionPrompt` to construct the prompt
    - Call `parseLLMResponse` to validate each LLM response
    - Fall back to og:title as single `ExtractedPlace` with empty `contextualHints` when both LLMs fail
    - Log warning when falling back to og:title
    - Log warning when both API keys are missing
    - _Requirements: 3.3, 3.5, 4.3, 4.5, 5.3, 5.4, 5.5, 10.5_
  - [ ]* 2.12 Write property test for og:title fallback shape
    - **Property 6: og:title fallback produces correct shape**
    - **Validates: Requirements 5.3**
  - [ ]* 2.13 Write unit tests for fallback chain order and timeout enforcement
    - Mock DeepSeek and Gemini providers
    - Verify DeepSeek → Gemini → og:title execution order
    - Verify 10s timeout aborts and proceeds to next provider
    - Verify env var skip behavior (missing keys)
    - _Requirements: 3.5, 4.3, 4.5, 5.1, 5.2, 5.4, 10.3, 10.4, 10.5_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate AI extraction into scraper
  - [x] 4.1 Update `scrapeUrl` in `src/actions/scrapeUrl.ts`
    - Import and call `detectPlatform` to identify the source platform
    - Import and call `extractPlacesWithAI` with the extracted caption/description and og:title
    - Return updated `ScrapeResult` with `platform` and `extractedPlaces` fields
    - Remove singular `location` and `contextualHints` from the return value
    - When no caption is available, pass empty string to `extractPlacesWithAI`
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3_
  - [ ]* 4.2 Update existing scrapeUrl tests to match new ScrapeResult shape
    - Update `src/actions/__tests__/scrapeUrl.test.ts` and `src/actions/__tests__/scrapeUrl.pbt.test.ts`
    - Verify `extractedPlaces` array and `platform` field in assertions
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 5. Update MagicBar for batch geocoding and progress feedback
  - [x] 5.1 Refactor `MagicBar` handleSubmit for multi-place flow
    - Replace single `geocodeLocation` call with `Promise.allSettled` over `extractedPlaces`
    - Call `addPin` for each successfully geocoded place
    - Skip places with `error` or `needs_user_input` geocode status
    - Show "No places found in this post." when `extractedPlaces` is empty
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 5.2 Add batch processing status text to MagicBar
    - Display "Scanning for multiple spots..." during AI extraction
    - Display "Pinning spots..." during batch geocoding
    - Display "Pinned [X] spots from [Platform]!" on completion
    - Display error when zero places are successfully geocoded from a non-empty array
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [ ]* 5.3 Write unit tests for MagicBar batch geocoding and progress states
    - Mock scrapeUrl and geocodeLocation
    - Verify multiple pins created from multi-place result
    - Verify "No places found" error for empty extractedPlaces
    - Verify scanning/pinning/success status text transitions
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4_

- [x] 6. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Fix planner DnD sensor configuration
  - [x] 7.1 Update `usePlannerDnd` sensor setup in `src/hooks/usePlannerDnd.tsx`
    - Replace `PointerSensor` with `MouseSensor` (distance: 5px, no delay) and `TouchSensor` (delay: 200ms, tolerance: 8px)
    - Keep `KeyboardSensor` with `sortableKeyboardCoordinates` unchanged
    - Update imports from `@dnd-kit/core`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  - [ ]* 7.2 Write unit test for sensor configuration
    - Verify `MouseSensor` and `TouchSensor` are registered (not `PointerSensor`)
    - Verify `KeyboardSensor` is still present
    - Verify activation constraints match requirements
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 8. Update environment configuration
  - [x] 8.1 Add new environment variables to `.env.local.example`
    - Add `DEEPSEEK_API_KEY` and `GEMINI_API_KEY` placeholder entries
    - _Requirements: 10.1, 10.2_
  - [x] 8.2 Install `@google/generative-ai` dependency
    - Add the Gemini SDK package to project dependencies
    - _Requirements: 4.1_

- [x] 9. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already in devDependencies) and target `src/actions/__tests__/extractPlaces.pbt.test.ts`
- MapView marker drag and `elementsFromPoint` bridge logic require no changes (Requirements 9.1, 9.2, 9.3 are preserved by not modifying MapView)
- The `addPin` store interface is unchanged; it's simply called multiple times for batch results
