# Implementation Plan: Caption Heuristic Rewrite

## Overview

Rewrite `extractPlaceNameFromCaption` → `extractPlaceFromCaption` with structured `HeuristicResult | null` return type, 6 detection patterns in priority order, `isNarrative` filter, confidence scoring, orchestrator confidence gate, loud failure surface, and `needsReview` flag on pins. All changes scoped to the heuristic fallback path — the AI chain is untouched.

## Tasks

- [x] 1. Add new types and update existing types
  - [x] 1.1 Add `PatternId`, `HeuristicResult` types and update `Pin`, `ExtractedPlace`, `ScrapeError` in `src/types/index.ts`
    - Add `PatternId` string literal union type with all 6 pattern identifiers
    - Add `HeuristicResult` interface with `name`, `address`, `districtHint`, `confidence`, `pattern` fields
    - Add optional `needsReview?: boolean` field to `Pin` interface
    - Add optional `_heuristicConfidence?: number`, `_heuristicPattern?: PatternId`, `_needsReview?: boolean` fields to `ExtractedPlace` interface
    - Add optional `errorCode?: 'no_places_found' | 'network_error' | 'scrape_error'` field to `ScrapeError` interface
    - _Requirements: 1.2, 9.4, 9.5_

- [x] 2. Implement `isNarrative` filter
  - [x] 2.1 Implement `isNarrative(line: string): boolean` in `src/utils/extractPlacesUtils.ts`
    - Define the Place_Emoji set as a constant
    - Return `true` when line has ≥ 3 non-Place emoji codepoints
    - Return `true` when line has ≥ 2 consecutive `!` or `?` (including `‼️`, `⁉️`)
    - Return `true` when line ends with CJK sentence particle (啦, 呀, 喔, 吧, 嘅, 咗, 囉, 嘛, 啊, 哦, 呢, 吖)
    - Return `true` when punctuation+emoji chars outnumber CJK/Latin alphabetic chars
    - Export the function
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 2.2 Write unit tests for `isNarrative` with fixture set
    - Create `src/utils/__tests__/isNarrative.test.ts`
    - Include at least 20 narrative lines and 20 non-narrative lines from real CJK travel captions
    - Test each signal type independently (emoji density, exclamation clusters, sentence particles, punctuation ratio)
    - _Requirements: 6.7, 12.2_

- [x] 3. Implement `extractPlaceFromCaption` with all 6 patterns
  - [x] 3.1 Implement CJK Address Block detector (pattern 1, confidence 0.9)
    - Scan for lines matching `地址[：:]\s*.+`, look back up to 3 lines for name candidate
    - Handle Traditional and Simplified Chinese markers
    - Accept both full-width `：` and ASCII `:` colons with whitespace tolerance
    - Extract parenthesized district hint from name line
    - Skip name lines rejected by `isNarrative` (look back one additional line)
    - Skip name lines matching `ogTitle` (case-insensitive)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 Implement Place Emoji detector (pattern 2, confidence 0.75/0.85)
    - Match lines starting with any Place_Emoji followed by 2–80 chars of text
    - Strip trailing punctuation, hashtags, and non-Place emoji from name
    - Elevate confidence to 0.85 when next line has CJK address markers or `地址`
    - Populate `address` field when elevated
    - Skip candidates rejected by `isNarrative`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.3 Implement @mention detector (pattern 3, confidence 0.65/0.75)
    - Extract `@[A-Za-z0-9._]+` mentions, replace underscores/dots with spaces
    - Strip Region_Prefix tokens (2–3 letter geo prefix + `_`)
    - Skip mentions matching `ogTitle` (case-insensitive)
    - Set confidence 0.75 when caption has district hashtag, 0.65 otherwise
    - Populate `districtHint` from district hashtag
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 3.4 Implement Standalone Address detector (pattern 4, confidence 0.55)
    - Match CJK lines with ≥ 2 CJK_Address_Markers and ≥ 1 digit
    - Match English address pattern (digit + street-type word)
    - Populate `address` field with full matched line
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 3.5 Implement English Title-Separator detector (pattern 5, confidence 0.6)
    - Match first non-empty line containing separator from set `[｜ | · — – -]`
    - Extract text before first separator as candidate (2–80 chars)
    - Reject if `isNarrative` returns true
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 3.6 Implement First-Line Last-Resort detector (pattern 6, confidence 0.35)
    - Evaluate first non-empty line only after all other patterns fail
    - Accept only if 2–50 chars, `isNarrative` returns false, and doesn't match `ogTitle`
    - Return null if candidate fails any filter
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 3.7 Wire all patterns into `extractPlaceFromCaption` entry point
    - Export `extractPlaceFromCaption(caption: string, ogTitle?: string): HeuristicResult | null`
    - Export constants `CONFIDENCE_HIGH = 0.7` and `CONFIDENCE_MEDIUM = 0.4`
    - Evaluate patterns in strict priority order: CJK Block → Emoji → @mention → Standalone Address → English Separator → First-Line
    - Apply `isNarrative` gate to every candidate before returning
    - Return null for empty/whitespace-only captions
    - Remove old `extractPlaceNameFromCaption` function
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 6.6, 13.1_

- [x] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update orchestrator and downstream consumers
  - [x] 5.1 Update `extractPlacesWithAI` in `src/actions/extractPlaces.ts` to use new heuristic
    - Replace `extractPlaceNameFromCaption` import with `extractPlaceFromCaption`, `CONFIDENCE_HIGH`, `CONFIDENCE_MEDIUM`
    - Implement confidence gate: high (≥ 0.7) → normal pin, medium ([0.4, 0.7)) → `_needsReview: true`, low (< 0.4) or null → empty array
    - Build `contextualHints` from `address` and `districtHint`
    - Set `_heuristicConfidence` and `_heuristicPattern` on returned `ExtractedPlace`
    - Add structured logging for heuristic invocation (pattern, confidence, caption length, hasOgTitle)
    - _Requirements: 9.1, 10.1, 10.2, 10.3, 10.5, 11.1, 11.2, 13.2_

  - [x] 5.2 Update `geocodeLocation` in `src/actions/geocodeLocation.ts`
    - Add optional `heuristicConfidence?: number` parameter to input type
    - Log heuristic confidence when provided
    - _Requirements: 10.4_

  - [x] 5.3 Update MagicBar in `src/components/MagicBar.tsx`
    - Update empty `extractedPlaces` toast message to: "We couldn't identify a place in this post. Try pasting the place name directly."
    - Thread `_needsReview` from `ExtractedPlace` to `Pin.needsReview` during pin creation
    - Add `extraction_source`, `heuristic_pattern`, `heuristic_confidence` to `PIN_CREATED` analytics event when heuristic fields present
    - _Requirements: 9.3, 9.5, 11.3_

  - [x] 5.4 Update all remaining call sites importing `extractPlaceNameFromCaption`
    - Search for any other imports of the old function and update to `extractPlaceFromCaption`
    - Ensure all call sites handle `HeuristicResult | null` return type
    - _Requirements: 13.2, 13.4_

- [x] 6. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Test coverage
  - [ ]* 7.1 Write unit tests for `extractPlaceFromCaption` patterns
    - Create `src/utils/__tests__/extractPlaceFromCaption.test.ts`
    - Test CJK Address Block: ≥ 3 positive cases (Traditional, Simplified, with district hint) and ≥ 2 negative cases
    - Test Place Emoji: ≥ 3 positive cases (📍, 🏠, with address elevation) and ≥ 2 negative cases (too long, narrative)
    - Test @mention: ≥ 3 positive cases (with district hashtag, region prefix stripping, ogTitle skip) and ≥ 2 negative cases
    - Test Standalone Address: ≥ 3 positive cases (CJK, English) and ≥ 2 negative cases
    - Test English Title-Separator: ≥ 3 positive cases and ≥ 2 negative cases
    - Test First-Line Last-Resort: ≥ 3 positive cases and ≥ 2 negative cases (narrative, too long, matches ogTitle)
    - Test empty/whitespace input returns null
    - _Requirements: 12.1_

  - [ ]* 7.2 Write property-based tests for heuristic invariants
    - Create `src/utils/__tests__/extractPlaceFromCaption.pbt.test.ts`
    - Property: for all non-null returns, confidence is in [0.1, 1.0] and pattern is a valid PatternId
    - Property: for all inputs where `isNarrative(candidateName)` is true, that candidate is never returned as `name`
    - _Requirements: 12.3_

  - [ ]* 7.3 Write integration tests for confidence gate
    - Create `src/actions/__tests__/extractPlaces.heuristic.test.ts`
    - Test high-confidence path: heuristic returns confidence ≥ 0.7 → `ExtractedPlace` with `_needsReview: false`
    - Test medium-confidence path: heuristic returns confidence in [0.4, 0.7) → `ExtractedPlace` with `_needsReview: true`
    - Test low-confidence/null path: heuristic returns confidence < 0.4 or null → empty array
    - Test `needs_user_input` geocode result with heuristic source → loud failure
    - _Requirements: 12.4_

- [x] 8. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The design uses TypeScript throughout — all implementations use TypeScript
- The AI chain (Custom LLM → Gemini → DeepSeek) is untouched; only the fallback heuristic path changes
- No new runtime dependencies are introduced (Requirement 13.3)
