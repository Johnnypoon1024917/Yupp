# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Affiliate Link URL Encoding with Title+City
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the literal `+` concatenation bug in `getAffiliateLink`
  - **Scoped PBT Approach**: Scope the property to concrete failing cases — Pins with a recognized `primaryType` AND a non-empty `address`
  - Create test file `src/utils/__tests__/affiliateLinks.bugcondition.test.ts` using Vitest + fast-check
  - Generate Pins where `isBugCondition(X)` holds: `primaryType` matches a recognized category keyword AND `address` is defined and non-empty
  - For each generated Pin, call `getAffiliateLink(pin)`, parse the result URL with `new URL()`, and extract the search param via `url.searchParams.get(paramKey)`
  - Assert that the decoded search parameter equals `pin.title + " " + extractCity(pin.address)` (space-separated, no literal `+` between encoded segments)
  - Include concrete cases from design: CJK title (`"瀧宴日本料理"` + `"123 Main St, 銅鑼灣, Hong Kong"`), English multi-word (`"The Grand Hotel"` + `"100 Broadway, New York, USA"`), special characters (`"Café & Bar"` + `"1 Rue, Paris, France"`)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists because `searchParams.get(paramKey)` will NOT equal `"title city"` due to the literal `+` and manual `encodeURIComponent` producing a different decoded value)
  - Document counterexamples found (e.g., "searchParams.get('q') returns 'title+city' with literal plus instead of 'title city' with space")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Buggy Input Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Create test file `src/utils/__tests__/affiliateLinks.preservation.test.ts` using Vitest + fast-check
  - Observe on UNFIXED code: Pins with recognized `primaryType` but no `address` produce a valid affiliate URL with only the title as the search parameter
  - Observe on UNFIXED code: Pins with missing or unrecognized `primaryType` return `null`
  - Observe on UNFIXED code: Platform mapping is correct — Booking.com for hotel/lodging, TripAdvisor for restaurant/food/cafe, Klook for tourist_attraction/museum/park
  - Observe on UNFIXED code: `platformName`, `label`, and `bgColor` metadata fields are correct for each category
  - Observe on UNFIXED code: All generated URLs are parseable by the `URL` constructor
  - PBT Property 2a — Title-Only URL: For all Pins with a recognized `primaryType` and no `address`, assert `url.searchParams.get(paramKey)` equals `pin.title` (title-only search preserved)
  - PBT Property 2b — Null Return: For all Pins with missing or unrecognized `primaryType`, assert `getAffiliateLink` returns `null`
  - PBT Property 2c — Metadata Fields: For all Pins with a recognized `primaryType`, assert `platformName`, `label`, and `bgColor` match the expected category mapping
  - PBT Property 2d — URL Validity: For all Pins with a recognized `primaryType` (with or without address), assert `new URL(result.url)` does not throw
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix for affiliate link URL encoding

  - [x] 3.1 Implement the fix in `src/utils/affiliateLinks.ts`
    - Remove manual `encodeURIComponent()` calls for `encodedTitle` and `encodedCity` variables
    - Build a plain search string: if `pin.address` exists, `searchValue = pin.title + " " + extractCity(pin.address)`; otherwise `searchValue = pin.title`
    - Replace raw template literal URL construction with `URL`/`URLSearchParams` API: create `new URL(category.baseUrl)`, call `url.searchParams.set(category.paramKey, searchValue)`, return `url.toString()`
    - Eliminate the `${encodedTitle}+${encodedCity}` pattern entirely
    - Do NOT modify the `extractCity` helper function
    - _Bug_Condition: isBugCondition(input) where input.primaryType matches recognized keyword AND input.address is defined and non-empty_
    - _Expected_Behavior: new URL(result.url).searchParams.get(paramKey) === pin.title + " " + extractCity(pin.address)_
    - _Preservation: Pins without address produce title-only URL; unrecognized primaryType returns null; metadata fields unchanged_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Affiliate Link URL Encoding with Title+City
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior: decoded search param equals `"title city"`
    - When this test passes, it confirms the `URL`/`URLSearchParams` fix properly encodes the search query
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Buggy Input Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm title-only URLs, null returns, metadata fields, and URL validity are all unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite with `npx vitest run`
  - Ensure bug condition exploration test passes (confirming the fix)
  - Ensure preservation property tests pass (confirming no regressions)
  - Ensure existing `src/utils/__tests__/affiliateLinks.pbt.test.ts` tests still pass
  - Ask the user if questions arise
