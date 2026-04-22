# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** — Structured Place Extraction from Long Multilingual Captions
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate `extractPlaceNameFromCaption` returns `null` for long multilingual captions with extractable structured patterns
  - **Scoped PBT Approach**: Scope the property to concrete failing cases:
    - Caption with narrative first line (>60 chars) + `@panslut.tw` on a later line → expect non-null result containing the username
    - Caption with narrative first line + CJK address `臺中市西區福人街60-1號` on a later line → expect non-null result containing the address
    - Caption with narrative first line + emoji-marked info block `🏵️ 盤子餐廳` on a later line → expect non-null result containing the place name
    - Caption with all three patterns present → expect non-null result
  - From Bug Condition in design: `isBugCondition(input)` where `length(firstLine) > 60 AND NOT containsPlaceName(firstLine) AND (captionContainsAtMention OR captionContainsCJKAddress OR captionContainsStructuredEmojiBlock)`
  - Test assertions match Expected Behavior: `extractPlaceNameFromCaption(caption)` returns a non-null string extracted from @mention, CJK address, or emoji-block pattern
  - Create test file at `src/actions/__tests__/extractPlaces.bugcondition.test.ts`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists because the current heuristic only scans the first line)
  - Document counterexamples found (e.g., `extractPlaceNameFromCaption("今天跟朋友去了一家超棒的餐廳...\n@panslut.tw")` returns `null` instead of `"panslut.tw"`)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.3, 2.4, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Short Caption and Existing Pattern Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (cases where `isBugCondition` returns false):
    - Observe: `extractPlaceNameFromCaption("La Terrace ｜ 米芝蓮一星")` returns `"La Terrace"` (separator pattern)
    - Observe: `extractPlaceNameFromCaption("📍 台中市西區")` returns `"台中市西區"` (pin emoji pattern)
    - Observe: `extractPlaceNameFromCaption("好吃的拉麵店")` returns `"好吃的拉麵店"` (short first line ≤60 chars)
    - Observe: `extractPlaceNameFromCaption("")` returns `null` (empty caption)
    - Observe: `extractPlaceNameFromCaption("Café de Flore - Paris")` returns `"Café de Flore"` (Latin separator)
  - Write property-based tests: for all captions with short first lines (≤60 chars), separator patterns, or 📍 patterns, the fixed function produces the same result as the original function
  - Generate random short captions, separator-pattern captions, and 📍-pattern captions to verify preservation across the input domain
  - Create test file at `src/actions/__tests__/extractPlaces.preservation.test.ts`
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

- [x] 3. Fix for Instagram caption extraction from long multilingual captions

  - [x] 3.1 Improve `EXTRACTION_PROMPT_TEMPLATE` for multilingual/CJK content
    - Update the prompt string at line 34 of `src/actions/extractPlaces.ts`
    - Add explicit instructions to ignore narrative/emotional text
    - Add instructions to prioritize @mentions, physical addresses, and business names
    - Add multilingual/CJK handling guidance (look for 市, 區, 路, 街, 號 address markers)
    - Instruct the model to look for structured info blocks (emoji-prefixed lines)
    - Keep the JSON output format requirement unchanged
    - _Bug_Condition: isBugCondition(input) where caption is long multilingual with extractable patterns_
    - _Expected_Behavior: LLM extracts actual business names/addresses instead of narrative text_
    - _Preservation: Existing JSON output format and extraction behavior for non-CJK captions unchanged_
    - _Requirements: 1.2, 2.2_

  - [x] 3.2 Extend `buildExtractionPrompt` to accept `ogTitle` as context
    - Add `ogTitle` as an optional second parameter to `buildExtractionPrompt` function
    - Include ogTitle in the prompt as "Post author / account name: {ogTitle}" context line when provided
    - This helps the LLM distinguish the author from place names in the caption
    - _Bug_Condition: LLM confuses author name with place name without ogTitle context_
    - _Expected_Behavior: buildExtractionPrompt(caption, ogTitle) includes ogTitle in prompt output_
    - _Preservation: buildExtractionPrompt(caption) without ogTitle continues to work as before_
    - _Requirements: 2.6_

  - [x] 3.3 Add @mention extraction pattern to `extractPlaceNameFromCaption`
    - After existing patterns fail on the first line, scan ALL caption lines for `@username` patterns
    - Use regex to match `@` followed by alphanumeric/dot/underscore characters
    - Extract the username portion (strip `@` prefix)
    - Return as candidate place name if found and length is between 2-100 chars
    - _Bug_Condition: isBugCondition(input) where captionContainsAtMention is true_
    - _Expected_Behavior: extractPlaceNameFromCaption returns the @mention username_
    - _Preservation: Existing patterns (separator, 📍, short first line) still checked first_
    - _Requirements: 1.3, 2.3_

  - [x] 3.4 Add CJK address extraction pattern to `extractPlaceNameFromCaption`
    - Scan all caption lines for CJK address patterns containing markers: 市, 區, 路, 街, 號, 巷, 弄
    - Use regex to match sequences containing at least two of these CJK address markers
    - Extract the full address string as a place identifier
    - Return as candidate place name if found and length is between 2-100 chars
    - _Bug_Condition: isBugCondition(input) where captionContainsCJKAddress is true_
    - _Expected_Behavior: extractPlaceNameFromCaption returns the CJK address string_
    - _Preservation: Existing patterns still checked first; CJK address is a new fallback layer_
    - _Requirements: 1.4, 2.4_

  - [x] 3.5 Add multi-line emoji block scanning to `extractPlaceNameFromCaption`
    - After first-line patterns, scan subsequent lines for emoji-prefixed info blocks
    - Recognize common place-indicator emojis beyond 📍 (e.g., 🏵️, 🏠, 🍽️, 🏪, etc.)
    - Extract the text following the emoji as a candidate place name
    - Return as candidate place name if found and length is between 2-100 chars
    - _Bug_Condition: isBugCondition(input) where captionContainsStructuredEmojiBlock is true_
    - _Expected_Behavior: extractPlaceNameFromCaption returns the emoji-block place name_
    - _Preservation: Existing 📍 pattern still works; new emoji patterns supplement it_
    - _Requirements: 1.5, 2.5_

  - [x] 3.6 Update `extractPlacesWithAI` to pass `ogTitle` to prompt builder
    - Change `buildExtractionPrompt(caption)` to `buildExtractionPrompt(caption, ogTitle)` in `extractPlacesWithAI`
    - The `ogTitle` parameter is already available in the function signature
    - _Bug_Condition: LLM receives no author context for disambiguation_
    - _Expected_Behavior: ogTitle is included in the prompt sent to all LLM providers_
    - _Preservation: Fallback chain order (Custom LLM → Gemini → DeepSeek → heuristic) unchanged_
    - _Requirements: 2.6_

  - [x] 3.7 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** — Structured Place Extraction from Long Multilingual Captions
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior for bug condition inputs
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from `src/actions/__tests__/extractPlaces.bugcondition.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** — Short Caption and Existing Pattern Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from `src/actions/__tests__/extractPlaces.preservation.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all existing extraction patterns (separator, 📍, short first line, empty caption) still produce identical results after the fix
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite to confirm no regressions
  - Verify bug condition exploration test passes (task 3.7)
  - Verify preservation property tests pass (task 3.8)
  - Verify any existing tests in the project still pass
  - Ask the user if questions arise
