import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { JSDOM } from 'jsdom';
import type { Page } from 'puppeteer-core';
import {
  detectLoginWall,
  extractTitle,
  extractImage,
  extractLocation,
  extractContextualHints,
} from '../scrapeUrl';

// ---------------------------------------------------------------------------
// Helper: create a mock Page whose `evaluate` runs the callback against a
// JSDOM document so we can exercise the real extraction logic without a browser.
// ---------------------------------------------------------------------------
function createMockPage(html: string): Page {
  const dom = new JSDOM(html);
  return {
    evaluate: async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => {
      const origDocument = globalThis.document;
      try {
        // @ts-expect-error – assigning JSDOM document to globalThis for evaluate
        globalThis.document = dom.window.document;
        return fn(...args);
      } finally {
        globalThis.document = origDocument;
      }
    },
  } as unknown as Page;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a simple alphanumeric string safe for HTML attribute values */
const safeText = fc.stringMatching(/^[a-zA-Z0-9 ]{1,40}$/);

/** Generates a non-empty trimmed string (for values that must be non-empty after trim) */
const nonEmptyTrimmed = safeText.filter((s) => s.trim().length > 0);

// ===================================================================
// Property 1 — Login wall detection
// **Validates: Requirements 4.1**
// ===================================================================

describe('Feature: headless-scraper-engine, Property 1: Login wall detection correctness', () => {
  const loginWallArb = fc.record({
    titleHasLogIn: fc.boolean(),
    hasArticle: fc.boolean(),
    hasMain: fc.boolean(),
    hasLoginForm: fc.boolean(),
  });

  it('detectLoginWall returns true IFF title contains "log in" AND no article AND no main AND has login form', async () => {
    await fc.assert(
      fc.asyncProperty(loginWallArb, async ({ titleHasLogIn, hasArticle, hasMain, hasLoginForm }) => {
        const title = titleHasLogIn ? 'Please Log In to continue' : 'Welcome to My Site';
        const articleTag = hasArticle ? '<article>content</article>' : '';
        const mainTag = hasMain ? '<main>content</main>' : '';
        const formTag = hasLoginForm ? '<form method="post"><input type="password" /></form>' : '';

        const html = `<html><head><title>${title}</title></head><body>${articleTag}${mainTag}${formTag}</body></html>`;

        const page = createMockPage(html);
        const result = await detectLoginWall(page);

        const expected = titleHasLogIn && !hasArticle && !hasMain && hasLoginForm;
        expect(result).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Property 2 — Image extraction priority
// **Validates: Requirements 5.1**
// ===================================================================

describe('Feature: headless-scraper-engine, Property 2: Image extraction priority', () => {
  const urlArb = fc.webUrl();

  const imageScenarioArb = fc.record({
    ogImage: fc.option(urlArb, { nil: undefined }),
    imgs: fc.array(
      fc.record({
        src: urlArb,
        width: fc.option(fc.integer({ min: 1, max: 500 }), { nil: undefined }),
        height: fc.option(fc.integer({ min: 1, max: 500 }), { nil: undefined }),
      }),
      { minLength: 0, maxLength: 5 },
    ),
  });

  it('og:image always wins when present', async () => {
    await fc.assert(
      fc.asyncProperty(imageScenarioArb, async ({ ogImage, imgs }) => {
        const ogMeta = ogImage ? `<meta property="og:image" content="${ogImage}" />` : '';
        const imgTags = imgs
          .map((img) => {
            const w = img.width !== undefined ? ` width="${img.width}"` : '';
            const h = img.height !== undefined ? ` height="${img.height}"` : '';
            return `<img src="${img.src}"${w}${h} />`;
          })
          .join('\n');

        const html = `<html><head>${ogMeta}</head><body>${imgTags}</body></html>`;

        const page = createMockPage(html);
        const result = await extractImage(page);

        if (ogImage) {
          expect(result).toBe(ogImage);
        } else {
          const qualifying = imgs.find((img) => {
            const w = img.width ?? 0;
            const h = img.height ?? 0;
            if (w > 0 && w < 100) return false;
            if (h > 0 && h < 100) return false;
            return true;
          });
          if (qualifying) {
            expect(result).toBe(qualifying.src);
          } else {
            expect(result).toBeNull();
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});


// ===================================================================
// Property 3 — Title extraction priority
// **Validates: Requirements 5.2**
// ===================================================================

describe('Feature: headless-scraper-engine, Property 3: Title extraction priority', () => {
  const titleScenarioArb = fc.record({
    ogTitle: fc.option(nonEmptyTrimmed, { nil: undefined }),
    titleElement: fc.option(nonEmptyTrimmed, { nil: undefined }),
  });

  it('og:title > <title> > "Untitled"', async () => {
    await fc.assert(
      fc.asyncProperty(titleScenarioArb, async ({ ogTitle, titleElement }) => {
        const ogMeta = ogTitle ? `<meta property="og:title" content="${ogTitle}" />` : '';
        const titleTag = titleElement ? `<title>${titleElement}</title>` : '';

        const html = `<html><head>${ogMeta}${titleTag}</head><body></body></html>`;

        const page = createMockPage(html);
        const result = await extractTitle(page);

        if (ogTitle) {
          expect(result).toBe(ogTitle.trim());
        } else if (titleElement) {
          expect(result).toBe(titleElement.trim());
        } else {
          expect(result).toBe('Untitled');
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Property 4 — Location extraction source priority
// **Validates: Requirements 5.3**
// ===================================================================

describe('Feature: headless-scraper-engine, Property 4: Location extraction source priority', () => {
  const locationScenarioArb = fc.record({
    geoPlacename: fc.option(nonEmptyTrimmed, { nil: undefined }),
    geoRegion: fc.option(nonEmptyTrimmed, { nil: undefined }),
    jsonLdLocation: fc.option(nonEmptyTrimmed, { nil: undefined }),
    locationLinkText: fc.option(
      nonEmptyTrimmed.filter((s) => s.trim().length > 1 && s.trim().length < 200),
      { nil: undefined },
    ),
    ogDescLocation: fc.option(
      fc.constantFrom('Bali', 'Paris', 'Tokyo', 'New York'),
      { nil: undefined },
    ),
  });

  it('highest-priority source always wins', async () => {
    await fc.assert(
      fc.asyncProperty(locationScenarioArb, async (scenario) => {
        const { geoPlacename, geoRegion, jsonLdLocation, locationLinkText, ogDescLocation } = scenario;

        const metas: string[] = [];
        if (geoPlacename) metas.push(`<meta name="geo.placename" content="${geoPlacename}" />`);
        if (geoRegion) metas.push(`<meta name="geo.region" content="${geoRegion}" />`);
        if (ogDescLocation) {
          metas.push(`<meta property="og:description" content="📍 ${ogDescLocation}" />`);
        }

        const jsonLd = jsonLdLocation
          ? `<script type="application/ld+json">${JSON.stringify({ location: jsonLdLocation })}</script>`
          : '';

        const locationLink = locationLinkText
          ? `<a href="/explore/locations/123">${locationLinkText}</a>`
          : '';

        const html = `<html><head>${metas.join('\n')}${jsonLd}</head><body>${locationLink}</body></html>`;

        const page = createMockPage(html);
        const result = await extractLocation(page);

        if (geoPlacename) {
          expect(result).toBe(geoPlacename.trim());
        } else if (geoRegion) {
          expect(result).toBe(geoRegion.trim());
        } else if (jsonLdLocation) {
          expect(result).toBe(jsonLdLocation);
        } else if (locationLinkText && locationLinkText.trim().length > 1) {
          expect(result).toBe(locationLinkText.trim());
        } else if (ogDescLocation) {
          expect(result).toBe(ogDescLocation);
        } else {
          expect(result).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });
});


// ===================================================================
// Property 5 — Contextual hints extraction
// **Validates: Requirements 5.4**
// ===================================================================

describe('Feature: headless-scraper-engine, Property 5: Contextual hints pattern extraction', () => {
  // Generate a capitalized place name like "Bali", "Paris" (3-9 lowercase chars after capital)
  const placeNameArb = fc.stringMatching(/^[A-Z][a-z]{2,8}$/);

  // Generate a pin emoji pattern like "📍 Paris"
  const pinPatternArb = placeNameArb.map((name) => `📍 ${name}`);

  // Generate a hashtag like "#BaliTrip" (3-12 alpha chars)
  const hashtagArb = fc.stringMatching(/^[A-Za-z]{3,12}$/).map((s) => `#${s}`);

  it('all matching patterns extracted and result capped at 10', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(placeNameArb, { minLength: 0, maxLength: 5 }),
        fc.array(pinPatternArb, { minLength: 0, maxLength: 3 }),
        fc.array(hashtagArb, { minLength: 0, maxLength: 5 }),
        async (placeNames, pinPatterns, hashtags) => {
          const bodyText = [...placeNames, ...pinPatterns, ...hashtags].join(' ');

          const html = `<html><head></head><body>${bodyText}</body></html>`;

          const page = createMockPage(html);
          const result = await extractContextualHints(page);

          // Result should be capped at 10
          expect(result.length).toBeLessThanOrEqual(10);

          // Each hint should be a non-empty string
          for (const hint of result) {
            expect(typeof hint).toBe('string');
            expect(hint.length).toBeGreaterThan(0);
          }

          // Verify each place name appears in at least one hint.
          // Adjacent capitalized words may be merged into a single match
          // (e.g., "Bali Paris" → one hint "Bali Paris"), so we check substring containment.
          if (result.length < 10) {
            for (const name of placeNames) {
              const found = result.some((hint) => hint.includes(name));
              expect(found).toBe(true);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Property 6 — og:locale exclusion
// **Validates: Requirements 6.1**
// ===================================================================

describe('Feature: headless-scraper-engine, Property 6: og:locale exclusion', () => {
  const localeArb = fc.constantFrom('en_US', 'fr_FR', 'de_DE', 'ja_JP', 'es_ES', 'pt_BR', 'zh_CN', 'ko_KR');

  it('extractLocation returns null when og:locale is the only location-like data', async () => {
    await fc.assert(
      fc.asyncProperty(localeArb, async (locale) => {
        const html = `<html><head><meta property="og:locale" content="${locale}" /><title>Some Page</title></head><body><p>This is a page with no location data.</p></body></html>`;

        const page = createMockPage(html);
        const result = await extractLocation(page);

        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
