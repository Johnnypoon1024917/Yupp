'use server';

import puppeteer from 'puppeteer-core';
import type { Browser, Page } from 'puppeteer-core';
import type { ScrapeResult, ScrapeError } from '@/types';

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Connect to a remote browser via WebSocket using BROWSERLESS_URL env var.
 * Never uses puppeteer.launch().
 */
export async function connectBrowser(): Promise<Browser> {
  const browserWSEndpoint = process.env.BROWSERLESS_URL;
  if (!browserWSEndpoint) {
    throw new Error('BROWSERLESS_URL environment variable is not configured');
  }
  return puppeteer.connect({ browserWSEndpoint });
}

/**
 * Create a new page with desktop viewport and realistic User-Agent.
 */
export async function setupPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent(DESKTOP_USER_AGENT);
  return page;
}

/**
 * Navigate to a URL with networkidle2 wait strategy and 30s timeout.
 */
export async function navigateWithTimeout(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
}

/**
 * Detect if the page is showing a login wall.
 * Returns true if the title contains "log in" (case-insensitive) AND
 * the page lacks both <article> and <main> elements while containing a login form.
 */
export async function detectLoginWall(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const title = document.title || '';
    const hasLogInTitle = /log\s*in/i.test(title);
    if (!hasLogInTitle) return false;

    const hasArticle = !!document.querySelector('article');
    const hasMain = !!document.querySelector('main');
    const hasLoginForm = !!document.querySelector('form[method], form[action], input[type="password"]');

    return !hasArticle && !hasMain && hasLoginForm;
  });
}

/**
 * Extract page title: og:title → <title> → "Untitled"
 */
export async function extractTitle(page: Page): Promise<string> {
  return page.evaluate(() => {
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    if (ogTitle?.trim()) return ogTitle.trim();

    const titleEl = document.querySelector('title');
    if (titleEl?.textContent?.trim()) return titleEl.textContent.trim();

    return 'Untitled';
  });
}

/**
 * Extract image: og:image → first large <img> (skip width/height < 100) → null
 */
export async function extractImage(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (ogImage?.trim()) return ogImage.trim();

    const images = document.querySelectorAll('img');
    for (const img of images) {
      const src = img.getAttribute('src');
      if (!src) continue;

      const width = parseInt(img.getAttribute('width') || '0', 10);
      const height = parseInt(img.getAttribute('height') || '0', 10);

      // Skip small images (icons, spacers)
      if ((width > 0 && width < 100) || (height > 0 && height < 100)) continue;

      return src;
    }

    return null;
  });
}

/**
 * Extract location using priority chain:
 * 1. geo meta tags (geo.placename, geo.region)
 * 2. JSON-LD structured data
 * 3. Rendered location link elements
 * 4. og:description patterns
 * 5. Body text patterns (📍, "in City, Country")
 *
 * NEVER uses og:locale.
 */
export async function extractLocation(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    // --- Priority 1: geo meta tags ---
    const geoPlaceName = document.querySelector('meta[name="geo.placename"]')?.getAttribute('content');
    if (geoPlaceName?.trim()) return geoPlaceName.trim();

    const geoRegion = document.querySelector('meta[name="geo.region"]')?.getAttribute('content');
    if (geoRegion?.trim()) return geoRegion.trim();

    // --- Priority 2: JSON-LD structured data ---
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        const loc = extractLocationFromJsonLd(data);
        if (loc) return loc;
      } catch {
        // Skip invalid JSON-LD
      }
    }

    // --- Priority 3: Rendered location link elements ---
    // Instagram-style location links and common location link patterns
    const locationSelectors = [
      'a[href*="/explore/locations/"]',
      'a[href*="/locations/"]',
      'a[href*="maps.google"]',
      'a[href*="goo.gl/maps"]',
      '[class*="location"] a',
      '[data-testid*="location"]',
    ];
    for (const selector of locationSelectors) {
      const el = document.querySelector(selector);
      if (el?.textContent?.trim()) {
        const text = el.textContent.trim();
        if (text.length > 1 && text.length < 200) return text;
      }
    }

    // --- Priority 4: og:description patterns ---
    const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
    if (ogDesc) {
      const descLocation = extractLocationFromText(ogDesc);
      if (descLocation) return descLocation;
    }

    // --- Priority 5: Body text patterns ---
    const bodyText = document.body?.textContent || '';
    const bodyLocation = extractLocationFromText(bodyText);
    if (bodyLocation) return bodyLocation;

    return null;

    // --- Helper: extract location from JSON-LD ---
    function extractLocationFromJsonLd(data: unknown): string | null {
      if (!data || typeof data !== 'object') return null;
      const obj = data as Record<string, unknown>;

      if (obj.location) {
        if (typeof obj.location === 'string') return obj.location;
        if (typeof obj.location === 'object' && obj.location !== null) {
          const loc = obj.location as Record<string, unknown>;
          if (typeof loc.name === 'string' && loc.name.trim()) return loc.name.trim();
          if (loc.address) {
            const addrResult = parseAddress(loc.address);
            if (addrResult) return addrResult;
          }
        }
      }

      if (obj.contentLocation) {
        if (typeof obj.contentLocation === 'string') return obj.contentLocation;
        if (typeof obj.contentLocation === 'object' && obj.contentLocation !== null) {
          const loc = obj.contentLocation as Record<string, unknown>;
          if (typeof loc.name === 'string' && loc.name.trim()) return loc.name.trim();
        }
      }

      if (obj.address) {
        const addrResult = parseAddress(obj.address);
        if (addrResult) return addrResult;
      }

      if (Array.isArray(obj['@graph'])) {
        for (const item of obj['@graph']) {
          const result = extractLocationFromJsonLd(item);
          if (result) return result;
        }
      }

      return null;
    }

    function parseAddress(address: unknown): string | null {
      if (typeof address === 'string' && address.trim()) return address.trim();
      if (typeof address === 'object' && address !== null) {
        const addr = address as Record<string, unknown>;
        const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
          .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
          .map((p) => p.trim());
        if (parts.length > 0) return parts.join(', ');
      }
      return null;
    }

    // --- Helper: extract location from text ---
    function extractLocationFromText(text: string): string | null {
      // 📍 pattern
      const pinMatch = text.match(/📍\s*([A-Za-z\s,]+)/);
      if (pinMatch?.[1]?.trim()) {
        const loc = pinMatch[1].trim();
        if (loc.length > 2 && loc.length < 100) return loc;
      }

      // "in City, Country" pattern
      const inMatch = text.match(
        /(?:in|at|from|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)?)/
      );
      if (inMatch?.[1]?.trim()) {
        const loc = inMatch[1].trim();
        if (loc.length > 2 && loc.length < 100) return loc;
      }

      return null;
    }
  });
}

/**
 * Extract contextual hints: capitalized place names, 📍 patterns, place-like hashtags.
 * Scans rendered text, og:description, and caption-like elements.
 * Limited to 10 hints.
 */
export async function extractContextualHints(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const hints = new Set<string>();

    // Gather text from og:description
    const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

    // Gather text from caption-like elements
    const captionSelectors = [
      '[class*="caption"]',
      '[class*="bio"]',
      '[class*="description"]',
      '[data-testid*="caption"]',
      'article p',
    ];

    let captionText = ogDesc;
    for (const selector of captionSelectors) {
      const el = document.querySelector(selector);
      if (el?.textContent) {
        captionText += ' ' + el.textContent;
      }
    }

    // Also include general rendered body text
    const bodyText = document.body?.textContent || '';

    const allText = captionText + ' ' + bodyText;

    // Capitalized place names (e.g., "Bali", "New York")
    const placePattern = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)\b/g;
    let match;
    while ((match = placePattern.exec(allText)) !== null) {
      if (match[1] && match[1].length > 2) {
        hints.add(match[1]);
      }
    }

    // 📍 patterns
    const pinPattern = /📍\s*([A-Za-z\s,]+)/g;
    while ((match = pinPattern.exec(allText)) !== null) {
      if (match[1]?.trim()) {
        hints.add(match[1].trim());
      }
    }

    // Place-like hashtags (e.g., #BaliIndonesia → "Bali Indonesia")
    const hashtagPattern = /#([A-Za-z]{3,})/g;
    while ((match = hashtagPattern.exec(allText)) !== null) {
      if (match[1]) {
        const expanded = match[1].replace(/([a-z])([A-Z])/g, '$1 $2');
        hints.add(expanded);
      }
    }

    return Array.from(hints).slice(0, 10);
  });
}

/**
 * Main scrapeUrl function — public API.
 * Validates URL, connects to remote browser, navigates, detects login walls,
 * extracts metadata, and returns ScrapeResult or ScrapeError.
 * Always closes browser in finally block.
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult | ScrapeError> {
  // Validate URL format
  try {
    new URL(url);
  } catch {
    return { success: false, error: 'Invalid URL format' };
  }

  let browser: Browser | null = null;
  try {
    // Connect to remote browser
    try {
      browser = await connectBrowser();
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      if (detail === 'BROWSERLESS_URL environment variable is not configured') {
        return { success: false, error: detail };
      }
      return { success: false, error: `Failed to connect to browser service: ${detail}` };
    }

    // Setup page
    const page = await setupPage(browser);

    // Navigate with timeout
    try {
      await navigateWithTimeout(page, url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('timeout') || message.includes('30000')) {
        return { success: false, error: 'Page timed out after 30 seconds' };
      }
      return { success: false, error: `Navigation failed: ${message}` };
    }

    // Detect login wall
    const isLoginWall = await detectLoginWall(page);
    if (isLoginWall) {
      return {
        success: false,
        error: 'Instagram is blocking access. Try pasting the location name manually.',
      };
    }

    // Extract metadata
    const title = await extractTitle(page);
    const imageUrl = await extractImage(page);
    const location = await extractLocation(page);
    const contextualHints = await extractContextualHints(page);

    console.log('[scrapeUrl] Extracted:', { title, imageUrl: imageUrl?.slice(0, 80), location, contextualHints });

    // Location is required
    if (!location) {
      return {
        success: false,
        error: 'Could not determine location from the provided URL.',
      };
    }

    return {
      success: true,
      title,
      imageUrl,
      location,
      contextualHints,
      sourceUrl: url,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr: unknown) {
        console.error('Failed to close browser:', closeErr);
      }
    }
  }
}
