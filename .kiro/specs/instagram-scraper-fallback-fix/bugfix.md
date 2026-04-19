# Bugfix Requirements Document

## Introduction

The URL scraper in the Travel Pin Board application produces wildly inaccurate pin locations when users paste Instagram URLs. This happens due to a two-part failure chain: (1) Instagram returns a login wall page instead of actual post content, and (2) the `extractLocation` function falls through to an `og:locale` country code fallback that feeds a vague 2-letter code (e.g., "US") to the Nominatim geocoder, resulting in nonsensical coordinates (e.g., US Virgin Islands). This bug undermines the core value of the pin board — accurate travel pin placement.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the scraper fetches an Instagram URL and Instagram returns a "Log in to Instagram" login wall page THEN the system proceeds to parse the login page HTML as if it were real post content, extracting meaningless metadata

1.2 WHEN the `extractLocation` function cannot find real location data (geo meta tags, JSON-LD, or text patterns) in the scraped HTML AND an `og:locale` meta tag is present with a value other than `en_US` or `en_GB` THEN the system extracts a 2-letter country code (e.g., "FR" from "fr_FR") and returns it as the location string

1.3 WHEN a 2-letter country code derived from `og:locale` is passed to the Nominatim geocoder THEN the system returns inaccurate or wildly incorrect coordinates (e.g., returning US Virgin Islands or Northern Mariana Islands coordinates for "US")

### Expected Behavior (Correct)

2.1 WHEN the scraper fetches an Instagram URL and Instagram returns a login wall page (detected by the page title containing "login") THEN the system SHALL return a `ScrapeError` with the message "Instagram blocked our scraper! Try pasting the location name directly into the search bar." without attempting to extract location data

2.2 WHEN the `extractLocation` function cannot find real location data from geo meta tags, JSON-LD structured data, or text patterns THEN the system SHALL NOT fall back to extracting a country code from the `og:locale` meta tag, and SHALL instead return `null` indicating no location was found

2.3 WHEN `extractLocation` returns `null` because no reliable location data was found THEN the system SHALL return a `ScrapeError` with the message "Could not determine location from the provided URL"

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the scraper fetches a non-Instagram URL that contains valid geo meta tags (e.g., `geo.placename`, `geo.region`) THEN the system SHALL CONTINUE TO extract and return the location from those meta tags

3.2 WHEN the scraper fetches a non-Instagram URL that contains valid JSON-LD structured data with location information THEN the system SHALL CONTINUE TO extract and return the location from the structured data

3.3 WHEN the scraper fetches a non-Instagram URL that contains location patterns in body text (e.g., "📍 Paris, France") THEN the system SHALL CONTINUE TO extract and return the location from text pattern matching

3.4 WHEN the scraper fetches a URL that returns valid HTML with a real title, image, and location THEN the system SHALL CONTINUE TO return a successful `ScrapeResult` with the extracted title, image URL, location, and contextual hints

3.5 WHEN the scraper fetches a URL that fails to load (network error, timeout, non-200 status) THEN the system SHALL CONTINUE TO return a `ScrapeError` with an appropriate error message

3.6 WHEN the scraper receives an invalid URL format THEN the system SHALL CONTINUE TO return a `ScrapeError` with "Invalid URL format"

---

## Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ScrapeInput (url: string, html: string)
  OUTPUT: boolean

  // The bug triggers when EITHER condition is true:
  // Condition A: Instagram login wall — Instagram URL returns a login page
  // Condition B: og:locale fallback — no real location data exists but og:locale is present
  
  hasInstagramLoginWall ← X.url CONTAINS "instagram.com" 
                          AND extractTitle(X.html) CONTAINS "login" (case-insensitive)
  
  hasNoRealLocation ← geo.placename IS NULL
                       AND geo.region IS NULL
                       AND geo.position IS NULL
                       AND ICBM IS NULL
                       AND JSON-LD location IS NULL
                       AND text pattern match IS NULL
  
  hasOgLocale ← og:locale IS NOT NULL
                AND og:locale ≠ "en_US"
                AND og:locale ≠ "en_GB"
  
  RETURN hasInstagramLoginWall OR (hasNoRealLocation AND hasOgLocale)
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking — Instagram login wall detection
FOR ALL X WHERE X.url CONTAINS "instagram.com" AND title CONTAINS "login" DO
  result ← scrapeUrl'(X.url)
  ASSERT result.success = false
  ASSERT result.error = "Instagram blocked our scraper! Try pasting the location name directly into the search bar."
END FOR

// Property: Fix Checking — og:locale fallback removal
FOR ALL X WHERE hasNoRealLocation(X) AND hasOgLocale(X) DO
  result ← scrapeUrl'(X.url)
  ASSERT result.success = false
  ASSERT result.error = "Could not determine location from the provided URL"
END FOR
```

### Preservation Checking Property

```pascal
// Property: Preservation Checking — non-buggy inputs produce identical results
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT scrapeUrl(X.url) = scrapeUrl'(X.url)
END FOR
```
