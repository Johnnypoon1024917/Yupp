'use server';

import * as cheerio from 'cheerio';
import type { ScrapeResult, ScrapeError } from '@/types';

// User-Agent rotation pool (5+ common browser UA strings)
const USER_AGENTS: string[] = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
];

const MAX_RETRIES = 3;
const TIMEOUT_MS = 15000;

function getRandomUA(exclude?: string): string {
  const pool = exclude ? USER_AGENTS.filter((ua) => ua !== exclude) : USER_AGENTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function fetchWithRetry(url: string): Promise<{ html: string } | { error: string }> {
  let lastUA: string | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ua = getRandomUA(lastUA);
    lastUA = ua;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (response.status === 403 && attempt < MAX_RETRIES) {
        continue; // Retry with different UA
      }

      if (!response.ok) {
        if (attempt < MAX_RETRIES && response.status >= 400) {
          continue;
        }
        return { error: `Request failed with status ${response.status}` };
      }

      const html = await response.text();
      return { html };
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (attempt < MAX_RETRIES) continue;

      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('abort')) {
        return { error: `Request timed out after ${TIMEOUT_MS / 1000} seconds` };
      }
      return { error: `Failed to fetch URL: ${message}` };
    }
  }

  return { error: 'Failed to fetch URL after all retry attempts' };
}

function extractImage($: cheerio.CheerioAPI): string | null {
  // Priority: og:image → twitter:image → first large <img>
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) return ogImage;

  const twitterImage = $('meta[name="twitter:image"]').attr('content')
    || $('meta[property="twitter:image"]').attr('content');
  if (twitterImage) return twitterImage;

  // Find first large image (width >= 200 or no explicit small dimensions)
  const images = $('img');
  for (let i = 0; i < images.length; i++) {
    const img = $(images[i]);
    const src = img.attr('src');
    if (!src) continue;

    const width = parseInt(img.attr('width') || '0', 10);
    const height = parseInt(img.attr('height') || '0', 10);

    // Skip tiny images (icons, spacers, etc.)
    if ((width > 0 && width < 100) || (height > 0 && height < 100)) continue;

    // Accept images with no explicit dimensions or large dimensions
    return src;
  }

  return null;
}

function extractTitle($: cheerio.CheerioAPI): string {
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle) return ogTitle.trim();

  const titleTag = $('title').text();
  if (titleTag) return titleTag.trim();

  return 'Untitled';
}

// Common location patterns in text (city, country pairs; "in Location"; "📍 Location")
const LOCATION_PATTERNS = [
  /📍\s*([A-Za-z\s,]+)/,
  /(?:in|at|from|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)?)/,
  /(?:located\s+(?:in|at))\s+([A-Za-z\s,]+)/i,
];

function extractLocation($: cheerio.CheerioAPI): string | null {
  // 1. Check og:locale (can hint at country)
  // 2. Check geo meta tags
  const geoPlaceName = $('meta[name="geo.placename"]').attr('content');
  if (geoPlaceName) return geoPlaceName.trim();

  const geoRegion = $('meta[name="geo.region"]').attr('content');
  if (geoRegion) return geoRegion.trim();

  const geoPosition = $('meta[name="geo.position"]').attr('content');
  const icbm = $('meta[name="ICBM"]').attr('content');
  if (geoPosition) return geoPosition.trim();
  if (icbm) return icbm.trim();

  // 3. Check structured data (JSON-LD)
  const jsonLdScripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < jsonLdScripts.length; i++) {
    try {
      const data = JSON.parse($(jsonLdScripts[i]).html() || '');
      const location = extractLocationFromStructuredData(data);
      if (location) return location;
    } catch {
      // Skip invalid JSON-LD
    }
  }

  // 4. Check og:locale for country hint
  const ogLocale = $('meta[property="og:locale"]').attr('content');
  if (ogLocale && ogLocale !== 'en_US' && ogLocale !== 'en_GB') {
    // Convert locale like "fr_FR" to a country name hint
    const parts = ogLocale.split('_');
    if (parts.length === 2 && parts[1]) {
      return parts[1]; // Return country code as location hint
    }
  }

  // 5. Search caption/body text for location patterns
  const bodyText = $('body').text();
  for (const pattern of LOCATION_PATTERNS) {
    const match = bodyText.match(pattern);
    if (match && match[1]) {
      const loc = match[1].trim();
      if (loc.length > 2 && loc.length < 100) return loc;
    }
  }

  return null;
}

function extractLocationFromStructuredData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;

  // Check for location/address fields
  if (obj.location) {
    if (typeof obj.location === 'string') return obj.location;
    if (typeof obj.location === 'object' && obj.location !== null) {
      const loc = obj.location as Record<string, unknown>;
      if (loc.name && typeof loc.name === 'string') return loc.name;
      if (loc.address) {
        if (typeof loc.address === 'string') return loc.address;
        if (typeof loc.address === 'object' && loc.address !== null) {
          const addr = loc.address as Record<string, unknown>;
          const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
            .filter(Boolean)
            .join(', ');
          if (parts) return parts;
        }
      }
    }
  }

  if (obj.contentLocation) {
    if (typeof obj.contentLocation === 'string') return obj.contentLocation;
    if (typeof obj.contentLocation === 'object' && obj.contentLocation !== null) {
      const loc = obj.contentLocation as Record<string, unknown>;
      if (loc.name && typeof loc.name === 'string') return loc.name;
    }
  }

  if (obj.address) {
    if (typeof obj.address === 'string') return obj.address;
    if (typeof obj.address === 'object' && obj.address !== null) {
      const addr = obj.address as Record<string, unknown>;
      const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
        .filter(Boolean)
        .join(', ');
      if (parts) return parts;
    }
  }

  // Check @graph array
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      const result = extractLocationFromStructuredData(item);
      if (result) return result;
    }
  }

  return null;
}

function extractContextualHints($: cheerio.CheerioAPI): string[] {
  const hints: Set<string> = new Set();

  // Extract from bio/description meta tags
  const description = $('meta[property="og:description"]').attr('content')
    || $('meta[name="description"]').attr('content')
    || '';

  // Extract from caption-like content
  const captionSelectors = [
    '[class*="caption"]',
    '[class*="bio"]',
    '[class*="description"]',
    '[data-testid*="caption"]',
    'article p',
  ];

  let captionText = description;
  for (const selector of captionSelectors) {
    const el = $(selector).first();
    if (el.length) {
      captionText += ' ' + el.text();
    }
  }

  // Extract location-like patterns from caption text
  // Look for capitalized place names (City, Country patterns)
  const placePattern = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)\b/g;
  let match;
  while ((match = placePattern.exec(captionText)) !== null) {
    if (match[1] && match[1].length > 2) {
      hints.add(match[1]);
    }
  }

  // Extract from 📍 emoji patterns
  const pinPattern = /📍\s*([A-Za-z\s,]+)/g;
  while ((match = pinPattern.exec(captionText)) !== null) {
    if (match[1]) {
      hints.add(match[1].trim());
    }
  }

  // Extract from hashtags that look like places
  const hashtagPattern = /#([A-Za-z]{3,})/g;
  while ((match = hashtagPattern.exec(captionText)) !== null) {
    if (match[1]) {
      // Convert camelCase hashtags: #BaliIndonesia → Bali Indonesia
      const expanded = match[1].replace(/([a-z])([A-Z])/g, '$1 $2');
      hints.add(expanded);
    }
  }

  return Array.from(hints).slice(0, 10); // Limit to 10 hints
}

export async function scrapeUrl(url: string): Promise<ScrapeResult | ScrapeError> {
  // Validate URL
  try {
    new URL(url);
  } catch {
    return { success: false, error: 'Invalid URL format' };
  }

  // Fetch HTML with retry logic
  const fetchResult = await fetchWithRetry(url);
  if ('error' in fetchResult) {
    return { success: false, error: fetchResult.error };
  }

  const $ = cheerio.load(fetchResult.html);

  // Extract metadata
  const title = extractTitle($);
  const imageUrl = extractImage($); // null if not found → placeholder
  const location = extractLocation($);
  const contextualHints = extractContextualHints($);

  // Location is required
  if (!location) {
    return {
      success: false,
      error: 'Could not determine location from the provided URL',
    };
  }

  return {
    success: true,
    title,
    imageUrl, // null signals caller to use placeholder
    location,
    contextualHints,
    sourceUrl: url,
  };
}
