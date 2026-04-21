# Requirements Document

## Introduction

The standard metadata extractor in `src/actions/scrapeUrl.ts` fails on Xiaohongshu (RED/小红书) URLs. Xiaohongshu hides post content inside dynamic JavaScript state objects and triggers aggressive login modals containing Chinese text ("登录"). The current `detectLoginWall` function may prematurely abort scraping, and the generic CSS/meta-tag extraction pipeline cannot reach the embedded post data. This feature implements a Xiaohongshu-specific extraction bypass that skips the login wall for Xiaohongshu pages and extracts post data directly from the page's JavaScript state or fallback DOM selectors.

## Glossary

- **Scraper**: The `scrapeUrl` server action in `src/actions/scrapeUrl.ts` that orchestrates browser connection, navigation, login wall detection, metadata extraction, and place extraction.
- **Platform**: A discriminated string union (`'instagram' | 'douyin' | 'xiaohongshu' | 'unknown'`) identifying the social media source of a URL, detected by `detectPlatform`.
- **Login_Wall_Detector**: The `detectLoginWall` function that inspects the page title and DOM to determine whether a login modal is blocking content access.
- **Xiaohongshu_Extractor**: The new `extractXiaohongshuData` function that extracts post title, description, and image URL from Xiaohongshu pages using platform-specific strategies.
- **Initial_State**: The `window.__INITIAL_STATE__` JavaScript object that Xiaohongshu injects into the page, containing server-rendered post data in `note.noteDetailMap`.
- **Generic_Extractor**: The existing extraction pipeline composed of `extractTitle`, `splitTitleAndDescription`, and `extractImage` that uses og:tags and DOM heuristics.
- **ScrapeResult**: The success return type containing `title`, `description`, `imageUrl`, `sourceUrl`, `platform`, and `extractedPlaces`.

## Requirements

### Requirement 1: Platform-Aware Login Wall Detection

**User Story:** As a user, I want to paste Xiaohongshu URLs without the scraper failing due to login modal detection, so that I can save places from Xiaohongshu posts.

#### Acceptance Criteria

1. WHEN `detectLoginWall` is called with a `platform` value of `'xiaohongshu'`, THE Login_Wall_Detector SHALL return `false` immediately without inspecting the DOM.
2. WHEN `detectLoginWall` is called with a `platform` value other than `'xiaohongshu'`, THE Login_Wall_Detector SHALL perform the existing login wall detection logic (title check, article/main presence, login form detection) and return the result.
3. THE Login_Wall_Detector SHALL accept a second parameter `platform` of type `Platform`.
4. THE Scraper SHALL resolve the `platform` value by calling `detectPlatform(url)` before calling `detectLoginWall`.
5. THE Scraper SHALL pass the resolved `platform` value as the second argument to `detectLoginWall(page, platform)`.

### Requirement 2: Xiaohongshu Data Extraction via JavaScript State

**User Story:** As a user, I want the scraper to extract Xiaohongshu post content from the embedded JavaScript state, so that I get accurate titles, descriptions, and images even when the page DOM is obscured by modals.

#### Acceptance Criteria

1. WHEN a Xiaohongshu page contains a `window.__INITIAL_STATE__` object with a populated `note.noteDetailMap`, THE Xiaohongshu_Extractor SHALL extract the `title`, `description`, and first image URL from the first entry in the `noteDetailMap`.
2. WHEN `window.__INITIAL_STATE__` is absent or `noteDetailMap` is empty, THE Xiaohongshu_Extractor SHALL fall back to DOM selectors: `#detail-title` for title, `#detail-desc` for description, and the first `img` inside `.note-scroller` for image URL.
3. WHEN both the Initial_State extraction and the DOM selector fallback yield no data, THE Xiaohongshu_Extractor SHALL return `null`.
4. THE Xiaohongshu_Extractor SHALL return an object with shape `{ title: string; description: string; imageUrl: string }` on success, or `null` on failure.
5. IF `window.__INITIAL_STATE__` contains malformed or unexpected data structures, THEN THE Xiaohongshu_Extractor SHALL not throw an error and SHALL proceed to the DOM selector fallback.

### Requirement 3: Xiaohongshu Routing in Main Scraper

**User Story:** As a user, I want Xiaohongshu URLs to be automatically routed through the specialized extractor, so that I get the best possible extraction results without any manual intervention.

#### Acceptance Criteria

1. WHEN the detected `platform` is `'xiaohongshu'`, THE Scraper SHALL call `extractXiaohongshuData(page)` before attempting the Generic_Extractor.
2. WHEN `extractXiaohongshuData` returns a non-null result, THE Scraper SHALL use the returned `title`, `description`, and `imageUrl` values to populate the ScrapeResult, bypassing the Generic_Extractor entirely.
3. WHEN `extractXiaohongshuData` returns `null`, THE Scraper SHALL fall back to the Generic_Extractor pipeline (`extractTitle`, `splitTitleAndDescription`, `extractImage`).
4. WHEN the detected `platform` is not `'xiaohongshu'`, THE Scraper SHALL use the Generic_Extractor pipeline as it does today.
5. THE Scraper SHALL pass the resolved `description` (from either the Xiaohongshu_Extractor or the Generic_Extractor) to `extractPlacesWithAI` for place extraction.
6. THE Scraper SHALL include the correct `platform` value in the returned ScrapeResult regardless of which extraction path was used.

### Requirement 4: Extraction Robustness and Error Handling

**User Story:** As a user, I want the scraper to handle unexpected Xiaohongshu page structures gracefully, so that a failed Xiaohongshu-specific extraction still falls back to the generic path instead of crashing.

#### Acceptance Criteria

1. IF `extractXiaohongshuData` throws an uncaught exception during page evaluation, THEN THE Scraper SHALL catch the error and fall back to the Generic_Extractor pipeline.
2. IF the `noteDetailMap` values contain entries missing `title`, `desc`, or `imageList` fields, THEN THE Xiaohongshu_Extractor SHALL treat the Initial_State attempt as failed and proceed to the DOM selector fallback.
3. WHEN the DOM selector fallback finds partial data (e.g., title present but no image), THE Xiaohongshu_Extractor SHALL return `null` rather than a partially populated object.
4. THE Xiaohongshu_Extractor SHALL execute within the same Puppeteer page context used by the rest of the Scraper, requiring no additional page navigations or browser connections.
