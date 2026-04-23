# Affiliate Link Encoding Fix — Bugfix Design

## Overview

The `getAffiliateLink` function in `src/utils/affiliateLinks.ts` manually calls `encodeURIComponent()` on `title` and `city` individually, then concatenates them with a literal `+` character and inserts the result into a raw URL template string. This bypasses proper URL parameter encoding: the `+` is never encoded, and the already-percent-encoded segments are placed directly into the URL without going through `URLSearchParams`. Affiliate platforms interpret the literal `+` as a character (not a space), producing broken search queries — particularly visible with CJK characters.

The fix replaces the manual encoding with the `URL`/`URLSearchParams` API. A plain `"title city"` string (space-separated) is passed to `URLSearchParams.set()`, which handles all percent-encoding in a single pass.

## Glossary

- **Bug_Condition (C)**: The input condition that triggers the bug — a Pin with a recognized `primaryType` AND a non-empty `address`, causing the code path that concatenates with a literal `+`
- **Property (P)**: The desired behavior — the URL search parameter decodes to `"title city"` (space-separated) with no literal `+` between encoded segments
- **Preservation**: Existing behavior that must remain unchanged — Pins without an address, Pins with unrecognized/missing `primaryType`, platform mapping, metadata fields, and URL validity
- **getAffiliateLink**: The pure function in `src/utils/affiliateLinks.ts` that maps a Pin's `primaryType` to an affiliate deep-link URL
- **extractCity**: Helper function that extracts the city component from a Pin's address string (second-to-last comma-separated segment)
- **CategoryConfig**: Internal mapping from `primaryType` keywords to affiliate platform details (base URL, param key, label, color)

## Bug Details

### Bug Condition

The bug manifests when a Pin has both a recognized `primaryType` (matching a category keyword) and a non-empty `address`. In this case, the function calls `encodeURIComponent()` on `title` and `city` separately, then joins them with a literal `+` character. This `+` is never encoded and sits between two already-percent-encoded strings, producing a malformed query parameter.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type Pin
  OUTPUT: boolean

  RETURN input.primaryType is defined
         AND input.primaryType matches at least one recognized category keyword
         AND input.address is defined and non-empty
END FUNCTION
```

### Examples

- **CJK title + address**: Pin `{ title: "瀧宴日本料理", address: "123 Main St, 銅鑼灣, Hong Kong", primaryType: "restaurant" }` → Current output URL contains `%E7%80%A7...%E7%90%86+%E9%8A%85%E9%91%BC%E7%81%A3` (literal `+` between encoded segments). Expected: `URLSearchParams` encodes `"瀧宴日本料理 銅鑼灣"` as a single value with `+` representing spaces per application/x-www-form-urlencoded.
- **Multi-word English title + address**: Pin `{ title: "The Grand Hotel", address: "100 Broadway, New York, USA", primaryType: "hotel" }` → Current output double-encodes spaces within title/city and inserts a literal `+` between them. Expected: `URLSearchParams` produces `ss=The+Grand+Hotel+New+York`.
- **Title with special characters + address**: Pin `{ title: "Café & Bar", address: "1 Rue, Paris, France", primaryType: "cafe" }` → Current output: `encodeURIComponent` encodes `&` as `%26` inside title, then a literal `+` is appended before the encoded city. Expected: `URLSearchParams` handles `&` and spaces uniformly.
- **Title only, no address** (not buggy): Pin `{ title: "Tokyo Tower", primaryType: "tourist_attraction" }` → Both old and new code produce the same result since the `+` concatenation path is skipped.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Pins with a recognized `primaryType` but no `address` must continue to produce a valid affiliate URL with only the title as the search parameter
- Pins with no `primaryType` or an unrecognized `primaryType` must continue to return `null`
- The category-to-platform mapping (Booking.com for hotel/lodging, TripAdvisor for restaurant/food/cafe, Klook for tourist_attraction/museum/park) must remain identical
- The returned `platformName`, `label`, and `bgColor` metadata fields must remain unchanged
- All generated URLs must remain parseable by the `URL` constructor without throwing
- The `extractCity` helper function is not modified and continues to work as before

**Scope:**
All inputs where `isBugCondition` is false should be completely unaffected by this fix. This includes:
- Pins without an `address` field (title-only search)
- Pins with missing or unrecognized `primaryType` (returns `null`)
- The metadata fields (`platformName`, `label`, `bgColor`) for all inputs

## Hypothesized Root Cause

Based on the bug description and source code analysis, the root cause is:

1. **Manual encoding + literal concatenation**: Lines 80–85 of `affiliateLinks.ts` call `encodeURIComponent(pin.title)` and `encodeURIComponent(city)` separately, then join them with a template literal `+`. This `+` is a raw character — it is never percent-encoded — and it sits between two already-encoded strings.

2. **Raw string URL construction**: Line 88 builds the URL as `` `${category.baseUrl}?${category.paramKey}=${searchValue}` ``. Because `searchValue` is already percent-encoded, inserting it directly into the URL string means the `+` remains literal. The `URL` constructor would not re-encode it since it's already in the query portion.

3. **Platform interpretation mismatch**: Affiliate platforms expect the search parameter value to be a single encoded string where `+` means space (per `application/x-www-form-urlencoded`). But the current code produces a `+` that was never part of proper encoding — it's a raw concatenation character. For CJK strings (which have no spaces), the `+` becomes the only non-percent-encoded character and is interpreted literally.

The fix is straightforward: build a plain `"title city"` string and let `URLSearchParams.set()` handle encoding. This eliminates both the manual `encodeURIComponent` calls and the literal `+`.

## Correctness Properties

Property 1: Bug Condition — Proper URL encoding for title+city queries

_For any_ Pin where the bug condition holds (recognized `primaryType` AND non-empty `address`), the fixed `getAffiliateLink` function SHALL produce a URL whose search parameter decodes to `"title city"` (space-separated), with no literal `+` between independently percent-encoded segments. Specifically, `new URL(result.url).searchParams.get(paramKey)` SHALL equal `pin.title + " " + extractCity(pin.address)`.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Non-buggy inputs produce identical results

_For any_ Pin where the bug condition does NOT hold (missing/unrecognized `primaryType`, or no `address`), the fixed `getAffiliateLink` function SHALL produce the same result as the original function, preserving null returns, title-only URLs, platform mapping, and metadata fields.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**


## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/utils/affiliateLinks.ts`

**Function**: `getAffiliateLink`

**Specific Changes**:

1. **Remove manual `encodeURIComponent` calls**: Delete the `encodedTitle` and `encodedCity` variables (lines ~80–84). These are no longer needed because `URLSearchParams` handles encoding.

2. **Build a plain search string**: Replace the encoded concatenation with a simple space-separated string:
   - If `pin.address` exists: `searchValue = pin.title + " " + extractCity(pin.address)`
   - If no address: `searchValue = pin.title`

3. **Use `URL`/`URLSearchParams` for URL construction**: Replace the raw template literal URL with:
   - Create a `URL` object from `category.baseUrl`
   - Call `url.searchParams.set(category.paramKey, searchValue)`
   - Use `url.toString()` as the final URL

4. **Remove literal `+` concatenation**: The `${encodedTitle}+${encodedCity}` pattern is eliminated entirely. The space in `"title city"` is encoded by `URLSearchParams` as `+` (per `application/x-www-form-urlencoded`), which platforms correctly interpret as a space.

5. **No changes to `extractCity`**: The helper function remains unchanged — it continues to extract the city segment from the address string.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that construct Pins with recognized `primaryType` and non-empty `address`, call `getAffiliateLink`, parse the resulting URL with `new URL()`, and assert that `searchParams.get(paramKey)` equals `"title city"`. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **CJK Title + Address**: Pin with `title: "瀧宴日本料理"`, `address: "123 Main St, 銅鑼灣, Hong Kong"`, `primaryType: "restaurant"` — assert decoded param equals `"瀧宴日本料理 銅鑼灣"` (will fail on unfixed code)
2. **English Multi-Word Title + Address**: Pin with `title: "The Grand Hotel"`, `address: "100 Broadway, New York, USA"`, `primaryType: "hotel"` — assert decoded param equals `"The Grand Hotel New York"` (will fail on unfixed code)
3. **Special Characters Title + Address**: Pin with `title: "Café & Bar"`, `address: "1 Rue, Paris, France"`, `primaryType: "cafe"` — assert decoded param equals `"Café & Bar Paris"` (will fail on unfixed code)
4. **Single-Segment Address**: Pin with `title: "Museum"`, `address: "Tokyo"`, `primaryType: "museum"` — assert decoded param equals `"Museum Tokyo"` (will fail on unfixed code)

**Expected Counterexamples**:
- `searchParams.get(paramKey)` will NOT equal `"title city"` because the literal `+` and double-encoding produce a different decoded value
- Possible causes: literal `+` is decoded as a space in the wrong position, or double-encoded `%25XX` sequences appear

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := getAffiliateLink_fixed(input)
  url := new URL(result.url)
  paramKey := categoryFor(input.primaryType).paramKey
  decoded := url.searchParams.get(paramKey)
  expected := input.title + " " + extractCity(input.address)
  ASSERT decoded = expected
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT getAffiliateLink_original(input) = getAffiliateLink_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for Pins without addresses and Pins with unrecognized types, then write property-based tests capturing that behavior. After the fix, these tests must still pass.

**Test Cases**:
1. **Title-Only URL Preservation**: Verify that Pins with recognized `primaryType` but no `address` produce the same URL before and after the fix
2. **Null Return Preservation**: Verify that Pins with missing or unrecognized `primaryType` continue to return `null`
3. **Metadata Preservation**: Verify that `platformName`, `label`, and `bgColor` remain identical for all recognized types
4. **URL Validity Preservation**: Verify that all generated URLs remain parseable by the `URL` constructor

### Unit Tests

- Test `getAffiliateLink` with CJK title + address: assert decoded search param equals `"title city"`
- Test `getAffiliateLink` with English multi-word title + address: assert decoded search param equals `"title city"`
- Test `getAffiliateLink` with special characters in title + address: assert proper encoding
- Test `getAffiliateLink` with title only (no address): assert search param equals title
- Test `getAffiliateLink` with unrecognized `primaryType`: assert returns `null`

### Property-Based Tests

- Generate random Pins with recognized `primaryType` and random addresses: assert `searchParams.get(paramKey)` equals `"title city"` for all generated inputs
- Generate random Pins without addresses: assert URL contains only the title as the search parameter, matching pre-fix behavior
- Generate random Pins with unrecognized `primaryType`: assert all return `null`, matching pre-fix behavior

### Integration Tests

- Test full flow: create a Pin with CJK title and address, generate affiliate link, verify the URL works when parsed by `URL` constructor and decoded search param matches expected query
- Test all three platforms (Booking.com, TripAdvisor, Klook) with title+city inputs to verify correct base URL and param key usage
- Test that `extractCity` + `getAffiliateLink` pipeline produces correct results for various address formats