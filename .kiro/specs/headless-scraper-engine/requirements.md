# Requirements Document

## Introduction

The Travel Pin Board application ("YUPP") currently uses `cheerio` for static HTML parsing in its URL scraper. This approach fails against client-side rendered (CSR) sites like Instagram, where content is rendered by JavaScript frameworks after initial page load. The scraper returns empty or fallback metadata, which feeds bad data to the geocoder and produces wildly inaccurate pin placements.

This feature replaces the `cheerio`-based scraping engine with a headless browser engine powered by `puppeteer-core` connected to a remote browser service (e.g., Browserless.io) via WebSocket. This enables full JavaScript execution, allowing the scraper to extract real metadata from CSR pages. The refactor also removes the dangerous `og:locale` country code fallback identified in the related bugfix spec, and introduces graceful failure when sites block automated access.

## Glossary

- **Scraper**: The server action (`scrapeUrl`) responsible for fetching a URL and extracting title, image, location, and contextual hints from the page content.
- **Headless_Browser**: A `puppeteer-core` browser instance connected to a remote browser service via WebSocket, capable of executing JavaScript and rendering CSR pages.
- **Remote_Browser_Service**: An external service (e.g., Browserless.io) that hosts headless Chromium instances accessible via a WebSocket endpoint.
- **BROWSERLESS_URL**: An environment variable containing the WebSocket endpoint URL for connecting to the Remote_Browser_Service.
- **Login_Wall**: A page served by a website (e.g., Instagram) that blocks content access and instead displays a login prompt, preventing the Scraper from extracting meaningful metadata.
- **CSR_Page**: A client-side rendered page where meaningful content is injected into the DOM by JavaScript frameworks after the initial HTML document loads.
- **ScrapeResult**: A TypeScript interface representing a successful scrape containing title, imageUrl, location, contextualHints, and sourceUrl fields.
- **ScrapeError**: A TypeScript interface representing a failed scrape containing a success flag of false and an error message string.
- **MagicBar**: The frontend component that invokes the Scraper and passes results to the geocoder.
- **Geocoder**: The server action (`geocodeLocation`) that converts location strings into latitude/longitude coordinates.

## Requirements

### Requirement 1: Dependency Migration

**User Story:** As a developer, I want to replace `cheerio` with `puppeteer-core` so that the Scraper can render JavaScript-heavy pages and extract accurate metadata from CSR sites.

#### Acceptance Criteria

1. THE build system SHALL include `puppeteer-core` as a production dependency and SHALL NOT include `cheerio` as a dependency.
2. THE Scraper module SHALL import from `puppeteer-core` and SHALL NOT import from `cheerio`.

### Requirement 2: Remote Browser Connection

**User Story:** As a developer, I want the Scraper to connect to a remote headless browser via WebSocket so that the application avoids bundling Chromium and stays within serverless deployment size limits.

#### Acceptance Criteria

1. WHEN the Scraper is invoked, THE Headless_Browser SHALL connect to the Remote_Browser_Service using the WebSocket endpoint specified in the BROWSERLESS_URL environment variable.
2. THE Scraper SHALL use `puppeteer.connect()` with the `browserWSEndpoint` parameter and SHALL NOT use `puppeteer.launch()`.
3. IF the BROWSERLESS_URL environment variable is not set or is empty, THEN THE Scraper SHALL return a ScrapeError with a descriptive error message indicating the missing configuration.
4. IF the connection to the Remote_Browser_Service fails, THEN THE Scraper SHALL return a ScrapeError with a descriptive error message.

### Requirement 3: Page Rendering and Wait Strategy

**User Story:** As a user, I want the Scraper to wait for JavaScript-rendered content to fully load so that metadata extraction works on CSR pages like Instagram.

#### Acceptance Criteria

1. WHEN the Headless_Browser opens a page, THE Scraper SHALL set the viewport to a standard desktop resolution (1280x800 minimum width and height).
2. WHEN the Headless_Browser opens a page, THE Scraper SHALL set a realistic desktop browser User-Agent string on the page.
3. WHEN the Headless_Browser navigates to a URL, THE Scraper SHALL wait using the `networkidle2` strategy to allow CSR frameworks to finish rendering.
4. IF the page does not reach network idle within 30 seconds, THEN THE Scraper SHALL treat the navigation as a timeout and return a ScrapeError.

### Requirement 4: Login Wall Detection

**User Story:** As a user, I want the Scraper to detect when a site blocks access with a login wall so that I get a clear, actionable error message instead of a pin placed at the wrong location.

#### Acceptance Criteria

1. WHEN the Headless_Browser finishes loading a page AND the page title or body content indicates a login wall (e.g., the page title contains "log in" case-insensitively, or the page lacks an `article` or `main` content element while containing a login form), THEN THE Scraper SHALL return a ScrapeError with the message "Instagram is blocking access. Try pasting the location name manually."
2. WHEN a Login_Wall is detected, THE Scraper SHALL NOT attempt to extract title, image, or location metadata from the page.

### Requirement 5: DOM-Based Data Extraction

**User Story:** As a user, I want the Scraper to extract accurate image, title, and location data from fully rendered pages so that my travel pins have correct information.

#### Acceptance Criteria

1. WHEN extracting an image, THE Scraper SHALL check for an `og:image` meta tag first, then fall back to the first high-resolution `img` element in the rendered DOM.
2. WHEN extracting a title, THE Scraper SHALL check for an `og:title` meta tag first, then fall back to the page `title` element, and return "Untitled" if neither is found.
3. WHEN extracting a location, THE Scraper SHALL check the following sources in order: geo meta tags (`geo.placename`, `geo.region`), JSON-LD structured data, rendered location link elements (e.g., Instagram location tags above photos), `og:description` content, and text patterns in the page body (e.g., "📍 Location" or "in City, Country" patterns).
4. WHEN extracting contextual hints, THE Scraper SHALL scan the rendered page text, `og:description`, and caption-like elements for capitalized place names, pin emoji patterns, and place-like hashtags.

### Requirement 6: Removal of og:locale Country Code Fallback

**User Story:** As a user, I want the Scraper to stop using the `og:locale` meta tag as a location fallback so that vague country codes like "US" are never sent to the Geocoder.

#### Acceptance Criteria

1. THE Scraper SHALL NOT use the `og:locale` meta tag as a source for location data under any circumstance.
2. WHEN the Scraper cannot find location data from any of the valid extraction sources (geo meta tags, JSON-LD, rendered location elements, og:description, text patterns), THE Scraper SHALL return a ScrapeError with the message "Could not determine location from the provided URL."

### Requirement 7: Graceful Failure

**User Story:** As a user, I want clear and actionable error messages when scraping fails so that I know what went wrong and what to do next.

#### Acceptance Criteria

1. IF the Headless_Browser navigation fails due to a network error, THEN THE Scraper SHALL return a ScrapeError with a message describing the network failure.
2. IF the Headless_Browser navigation times out, THEN THE Scraper SHALL return a ScrapeError with a message indicating the timeout.
3. IF the URL provided to the Scraper is not a valid URL format, THEN THE Scraper SHALL return a ScrapeError with the message "Invalid URL format."
4. WHEN the Scraper returns a ScrapeError, THE ScrapeError SHALL conform to the existing ScrapeError TypeScript interface with `success: false` and an `error` string field.

### Requirement 8: Resource Cleanup

**User Story:** As a developer, I want the Scraper to always close the browser connection after use so that remote browser sessions are not leaked, preventing memory exhaustion and zombie connections on the Remote_Browser_Service.

#### Acceptance Criteria

1. WHEN the Scraper finishes processing a URL (whether successfully or with an error), THE Scraper SHALL close the Headless_Browser connection by calling `browser.close()`.
2. THE Scraper SHALL execute the browser close operation inside a `finally` block to guarantee execution regardless of whether an error occurred during scraping.
3. IF `browser.close()` itself throws an error, THEN THE Scraper SHALL catch and log the error without overriding the original scrape result.

### Requirement 9: Type Compatibility

**User Story:** As a developer, I want the refactored Scraper to maintain the same TypeScript interface so that the MagicBar and Geocoder continue to work without modification.

#### Acceptance Criteria

1. THE Scraper SHALL export a `scrapeUrl` function that accepts a `string` URL parameter and returns `Promise<ScrapeResult | ScrapeError>`.
2. THE ScrapeResult interface SHALL retain the fields: `success: true`, `title: string`, `imageUrl: string | null`, `location: string`, `contextualHints: string[]`, and `sourceUrl: string`.
3. THE ScrapeError interface SHALL retain the fields: `success: false` and `error: string`.
4. THE Scraper refactor SHALL NOT modify the `ScrapeResult`, `ScrapeError`, `GeocodeResult`, or `GeocodeError` type definitions in `src/types/index.ts`.
