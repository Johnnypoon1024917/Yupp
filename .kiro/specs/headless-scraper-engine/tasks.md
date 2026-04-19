# Tasks: Headless Scraper Engine

## Task 1: Swap dependencies (cheerio → puppeteer-core)

- [x] 1.1 Remove `cheerio` from `package.json` dependencies
- [x] 1.2 Add `puppeteer-core` to `package.json` dependencies
- [x] 1.3 Run `npm install` to update `node_modules` and `package-lock.json`

## Task 2: Rewrite `src/actions/scrapeUrl.ts` — connection and page setup

- [x] 2.1 Replace all `cheerio` imports with `puppeteer-core` imports (`import puppeteer from 'puppeteer-core'`)
- [x] 2.2 Implement `connectBrowser()`: read `BROWSERLESS_URL` env var, return error if missing/empty, call `puppeteer.connect({ browserWSEndpoint })` — never use `puppeteer.launch()`
- [x] 2.3 Implement `setupPage(browser)`: call `browser.newPage()`, set viewport to `{ width: 1280, height: 800 }`, set a realistic desktop User-Agent string
- [x] 2.4 Implement `navigateWithTimeout(page, url)`: call `page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })`

## Task 3: Implement login wall detection

- [x] 3.1 Implement `detectLoginWall(page)`: check if page title contains "log in" (case-insensitive) AND page lacks `<article>` or `<main>` elements while containing a login form
- [x] 3.2 When login wall is detected, return `ScrapeError` with message `"Instagram is blocking access. Try pasting the location name manually."` and skip all extraction

## Task 4: Implement DOM-based extraction functions

- [x] 4.1 Implement `extractTitle(page)`: og:title → `<title>` → `"Untitled"` priority chain via `page.evaluate()`
- [x] 4.2 Implement `extractImage(page)`: og:image → first large `<img>` (skip images with width/height < 100) via `page.evaluate()`
- [x] 4.3 Implement `extractLocation(page)`: priority chain — geo meta tags (`geo.placename`, `geo.region`) → JSON-LD structured data → rendered location link elements → `og:description` patterns → body text patterns (📍, "in City, Country") via `page.evaluate()`. Do NOT use `og:locale` under any circumstance.
- [x] 4.4 Implement `extractContextualHints(page)`: scan rendered text, `og:description`, and caption-like elements for capitalized place names, 📍 patterns, and place-like hashtags via `page.evaluate()`. Limit to 10 hints.

## Task 5: Wire up main `scrapeUrl` function with error handling and cleanup

- [x] 5.1 Rewrite `scrapeUrl(url)` to: validate URL format, call `connectBrowser()`, `setupPage()`, `navigateWithTimeout()`, `detectLoginWall()`, then extraction functions, and return `ScrapeResult` or `ScrapeError`
- [x] 5.2 Wrap browser lifecycle in try/finally — call `browser.close()` in the `finally` block; catch and log errors from `browser.close()` without overriding the original result
- [x] 5.3 Ensure all error paths return `ScrapeError` conforming to the existing interface (`{ success: false, error: string }`)
- [x] 5.4 Verify `src/types/index.ts` is NOT modified — `ScrapeResult`, `ScrapeError`, `GeocodeResult`, `GeocodeError` remain unchanged

## Task 6: Write unit tests

- [x] 6.1 Add test for missing/empty `BROWSERLESS_URL` returning `ScrapeError`
- [x] 6.2 Add test for `puppeteer.connect()` failure returning `ScrapeError`
- [x] 6.3 Add test for navigation timeout returning `ScrapeError`
- [x] 6.4 Add test for network error during navigation returning `ScrapeError`
- [x] 6.5 Add test for invalid URL returning `ScrapeError` with `"Invalid URL format"`
- [x] 6.6 Add test for login wall detection returning correct `ScrapeError` message
- [x] 6.7 Add test for successful scrape returning `ScrapeResult` with all fields
- [x] 6.8 Add test for `browser.close()` called in both success and error paths
- [x] 6.9 Add test for `browser.close()` failure not overriding original result

## Task 7: Write property-based tests

- [-] 7.1 [PBT] Property 1 — Login wall detection: generate random page titles (with/without "log in") and body structures (with/without article/main), verify `detectLoginWall` correctness
- [~] 7.2 [PBT] Property 2 — Image extraction priority: generate DOMs with/without og:image and various img elements, verify og:image always wins when present
- [~] 7.3 [PBT] Property 3 — Title extraction priority: generate DOMs with/without og:title and title elements, verify priority chain og:title > title > "Untitled"
- [~] 7.4 [PBT] Property 4 — Location extraction source priority: generate DOMs with multiple location sources at different priority levels, verify highest-priority source is returned
- [~] 7.5 [PBT] Property 5 — Contextual hints extraction: generate text with place names, 📍 patterns, and hashtags, verify all matching patterns extracted and capped at 10
- [~] 7.6 [PBT] Property 6 — og:locale exclusion: generate DOMs with og:locale as only location-like data, verify extractLocation returns null
