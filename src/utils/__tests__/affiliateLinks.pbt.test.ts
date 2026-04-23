import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getAffiliateLink, extractCity } from '../affiliateLinks';
import type { Pin } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal Pin with the given overrides. */
function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    title: 'Test Place',
    imageUrl: 'https://example.com/img.jpg',
    sourceUrl: 'https://example.com',
    latitude: 0,
    longitude: 0,
    collectionId: 'unorganized',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Category → base URL mapping used for assertions
// ---------------------------------------------------------------------------

const CATEGORY_MAP: { keywords: string[]; baseUrl: string }[] = [
  {
    keywords: ['hotel', 'lodging'],
    baseUrl: 'https://www.booking.com/searchresults.html',
  },
  {
    keywords: ['restaurant', 'food', 'cafe'],
    baseUrl: 'https://www.tripadvisor.com/Search',
  },
  {
    keywords: ['tourist_attraction', 'museum', 'park'],
    baseUrl: 'https://www.klook.com/search/',
  },
];

function expectedBaseUrl(primaryType: string): string {
  for (const cat of CATEGORY_MAP) {
    if (cat.keywords.some((kw) => primaryType.includes(kw))) {
      return cat.baseUrl;
    }
  }
  throw new Error(`No base URL for primaryType: ${primaryType}`);
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** One of the recognized category keywords. */
const recognizedKeywordArb = fc.constantFrom(
  'hotel',
  'lodging',
  'restaurant',
  'food',
  'cafe',
  'tourist_attraction',
  'museum',
  'park',
);

/**
 * A primaryType string that contains a recognized keyword, optionally
 * surrounded by extra text (e.g. "luxury_hotel_resort").
 */
const recognizedPrimaryTypeArb = fc.tuple(
  fc.stringMatching(/^[a-z_]{0,8}$/),
  recognizedKeywordArb,
  fc.stringMatching(/^[a-z_]{0,8}$/),
).map(([prefix, kw, suffix]) => `${prefix}${kw}${suffix}`);

/** A non-empty title string (may contain unicode / special chars). */
const titleArb = fc.string({ minLength: 1, maxLength: 60 }).filter((s) => s.trim().length > 0);

/** An address string with at least one comma (so extractCity picks the second-to-last segment). */
const addressWithCityArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  )
  .map(([city, country]) => `123 Main St, ${city}, ${country}`);

// ===================================================================
// Property 1 — Category-to-platform mapping with correct URL construction
// **Validates: Requirements 1.1, 1.2, 1.3, 1.6, 1.7**
// ===================================================================

describe('Feature: monetization-engine, Property 1: Category-to-platform mapping with correct URL construction', () => {
  it('returns URL starting with the correct platform base URL and containing the encoded title (with address)', () => {
    fc.assert(
      fc.property(
        recognizedPrimaryTypeArb,
        titleArb,
        addressWithCityArb,
        (primaryType, title, address) => {
          const pin = makePin({ primaryType, title, address });
          const result = getAffiliateLink(pin);

          // Must return a result for recognized types
          expect(result).not.toBeNull();

          // URL starts with the correct platform base URL
          const base = expectedBaseUrl(primaryType);
          expect(result!.url).toContain(base);

          // Decoded search param equals "title city" (space-separated)
          const url = new URL(result!.url);
          const paramKey = url.search.split('=')[0].replace('?', '');
          const searchValue = url.searchParams.get(paramKey);
          const city = extractCity(address);
          expect(searchValue).toBe(`${title} ${city}`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns URL with title only and no city component when address is undefined', () => {
    fc.assert(
      fc.property(
        recognizedPrimaryTypeArb,
        titleArb,
        (primaryType, title) => {
          const pin = makePin({ primaryType, title, address: undefined });
          const result = getAffiliateLink(pin);

          expect(result).not.toBeNull();

          // URL starts with the correct platform base URL
          const base = expectedBaseUrl(primaryType);
          expect(result!.url).toContain(base);

          // Decoded search param equals the title (no city appended)
          const url = new URL(result!.url);
          const paramKey = url.search.split('=')[0].replace('?', '');
          const searchValue = url.searchParams.get(paramKey);
          expect(searchValue).toBe(title);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ===================================================================
// Property 2 — Unrecognized or missing primaryType returns null
// **Validates: Requirements 1.4, 1.5**
// ===================================================================

/** All recognized keywords that map to an affiliate platform. */
const RECOGNIZED_KEYWORDS = [
  'hotel',
  'lodging',
  'restaurant',
  'food',
  'cafe',
  'tourist_attraction',
  'museum',
  'park',
];

/**
 * Arbitrary that produces random strings guaranteed NOT to contain
 * any recognized keyword substring.
 */
const unrecognizedPrimaryTypeArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter(
    (s) => !RECOGNIZED_KEYWORDS.some((kw) => s.toLowerCase().includes(kw)),
  );

describe('Feature: monetization-engine, Property 2: Unrecognized or missing primaryType returns null', () => {
  it('returns null when primaryType is undefined', () => {
    fc.assert(
      fc.property(titleArb, (title) => {
        const pin = makePin({ title, primaryType: undefined });
        const result = getAffiliateLink(pin);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('returns null when primaryType is a random string without recognized keywords', () => {
    fc.assert(
      fc.property(
        unrecognizedPrimaryTypeArb,
        titleArb,
        (primaryType, title) => {
          const pin = makePin({ primaryType, title });
          const result = getAffiliateLink(pin);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ===================================================================
// Property 3 — Affiliate URL round-trip validity
// **Validates: Requirements 1.8**
// ===================================================================

describe('Feature: monetization-engine, Property 3: Affiliate URL round-trip validity', () => {
  it('produces a valid URL for any Pin with a recognized primaryType and address', () => {
    fc.assert(
      fc.property(
        recognizedPrimaryTypeArb,
        titleArb,
        addressWithCityArb,
        (primaryType, title, address) => {
          const pin = makePin({ primaryType, title, address });
          const result = getAffiliateLink(pin);

          // Must return a result for recognized types
          expect(result).not.toBeNull();

          // The URL must be parseable without throwing
          expect(() => new URL(result!.url)).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('produces a valid URL for any Pin with a recognized primaryType and no address', () => {
    fc.assert(
      fc.property(
        recognizedPrimaryTypeArb,
        titleArb,
        (primaryType, title) => {
          const pin = makePin({ primaryType, title, address: undefined });
          const result = getAffiliateLink(pin);

          // Must return a result for recognized types
          expect(result).not.toBeNull();

          // The URL must be parseable without throwing
          expect(() => new URL(result!.url)).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});
