# Bugfix Requirements Document

## Introduction

The `getAffiliateLink` function in `src/utils/affiliateLinks.ts` constructs affiliate search URLs by manually calling `encodeURIComponent()` on individual parts (title, city), concatenating them with a literal `+` character, and inserting the result directly into a URL template string. This bypasses proper URL parameter encoding, causing a raw `+` to appear in an already-percent-encoded string. Affiliate platforms (Klook, Booking.com, TripAdvisor) interpret this literal `+` as a character rather than a space separator, producing broken search queries — especially for CJK characters (e.g., "瀧宴日本料理+銅鑼灣") — that return zero results.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a Pin has both a title and an address THEN the system produces a URL where the search parameter contains a literal `+` between the percent-encoded title and percent-encoded city (e.g., `%E7%80%A7%E5%AE%B4%E6%97%A5%E6%9C%AC%E6%96%99%E7%90%86+%E9%8A%85%E9%91%BC%E7%81%A3`), resulting in affiliate platforms interpreting the `+` as a literal character rather than a space

1.2 WHEN a Pin has a title containing spaces or special characters and an address THEN the system double-encodes the search value by first calling `encodeURIComponent()` on parts individually and then inserting the concatenated result into a raw URL string without using proper URL parameter APIs

1.3 WHEN the constructed URL is used on affiliate platforms (Klook, Booking.com, TripAdvisor) with CJK or multi-word queries THEN the system returns zero search results because the search query is malformed due to the literal `+` in the encoded string

### Expected Behavior (Correct)

2.1 WHEN a Pin has both a title and an address THEN the system SHALL construct the search query as a plain string `"title city"` (space-separated) and use the `URL`/`URLSearchParams` API to properly encode it as a single URL parameter value

2.2 WHEN a Pin has a title containing spaces or special characters and an address THEN the system SHALL let `URLSearchParams` handle all percent-encoding in a single pass, avoiding any manual `encodeURIComponent()` calls or literal `+` concatenation

2.3 WHEN the constructed URL is used on affiliate platforms with CJK or multi-word queries THEN the system SHALL produce a properly encoded URL that affiliate platforms can decode into the correct search query, returning relevant results

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a Pin has a recognized primaryType but no address THEN the system SHALL CONTINUE TO produce a valid affiliate URL with only the title as the search parameter

3.2 WHEN a Pin has no primaryType or an unrecognized primaryType THEN the system SHALL CONTINUE TO return null

3.3 WHEN a Pin has a recognized primaryType THEN the system SHALL CONTINUE TO map it to the correct affiliate platform (Booking.com for hotel/lodging, TripAdvisor for restaurant/food/cafe, Klook for tourist_attraction/museum/park)

3.4 WHEN a Pin has a recognized primaryType THEN the system SHALL CONTINUE TO return the correct `platformName`, `label`, and `bgColor` in the result object

3.5 WHEN a valid affiliate URL is generated THEN the system SHALL CONTINUE TO produce a URL that is parseable by the `URL` constructor without throwing

---

## Bug Condition

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type Pin
  OUTPUT: boolean
  
  // The bug triggers when a Pin has a recognized primaryType AND an address,
  // because only then does the code concatenate with a literal "+"
  RETURN X.primaryType matches a recognized category keyword
     AND X.address is defined and non-empty
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking — Proper URL encoding for title+city queries
FOR ALL X WHERE isBugCondition(X) DO
  result ← getAffiliateLink'(X)
  url ← parse(result.url)
  searchParam ← url.searchParams.get(category.paramKey)
  
  // The decoded search parameter must be "title city" (space-separated, no literal "+")
  expectedQuery ← X.title + " " + extractCity(X.address)
  ASSERT searchParam = expectedQuery
  ASSERT result.url does NOT contain a literal "+" between encoded title and encoded city
END FOR
```

### Preservation Checking Property

```pascal
// Property: Preservation Checking — Non-buggy inputs behave identically
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT getAffiliateLink(X) = getAffiliateLink'(X)
END FOR
```
