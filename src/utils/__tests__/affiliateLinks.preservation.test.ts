import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getAffiliateLink } from '../affiliateLinks';
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
// Category mapping for assertions
// ---------------------------------------------------------------------------

interface CategoryExpectation {
  keywords: string[];
  paramKey: string;
  platformName: string;
  label: string;
  bgColor: string;
}

const CATEGORIES: CategoryExpectation[] = [
  { keywords: ['hotel', 'lodging'], paramKey: 'ss', platformName: 'Booking.com', label: 'Book Stay', bgColor: '#003580' },
  { keywords: ['restaurant', 'food', 'cafe'], paramKey: 'q', platformName: 'TripAdvisor', label: 'Reserve Table', bgColor: '#34E0A1' },
  { keywords: ['tourist_attraction', 'museum', 'park'], paramKey: 'query', platformName: 'Klook', label: 'Get Tickets', bgColor: '#FF5B00' },
];

function getCategoryForType(primaryType: string): CategoryExpectation | null {
  return CATEGORIES.find((cat) => cat.keywords.some((kw) => primaryType.includes(kw))) ?? null;
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

/** A non-empty title string (may contain unicode / special chars). */
const titleArb = fc.string({ minLength: 1, maxLength: 60 }).filter((s) => s.trim().length > 0);

/** All recognized keywords that map to an affiliate platform. */
const RECOGNIZED_KEYWORDS = [
  'hotel', 'lodging', 'restaurant', 'food', 'cafe',
  'tourist_attraction', 'museum', 'park',
];

/**
 * Arbitrary that produces random strings guaranteed NOT to contain
 * any recognized keyword substring.
 */
const unrecognizedPrimaryTypeArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => !RECOGNIZED_KEYWORDS.some((kw) => s.toLowerCase().includes(kw)));

/**
 * An address string with at least two comma-separated segments
 * so extractCity picks the second-to-last segment.
 */
const addressWithCityArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  )
  .map(([city, country]) => `123 Main St, ${city}, ${country}`);

// ===================================================================
// Property 2a — Title-Only URL
// **Validates: Requirements 3.1**
//
// For all Pins with a recognized primaryType and no address,
// url.searchParams.get(paramKey) equals pin.title
// ===================================================================

describe('Preservation Property 2a: Title-Only URL', () => {
  it('search param equals pin.title when no address is provided', () => {
    fc.assert(
      fc.property(
        recognizedKeywordArb,
        titleArb,
        (primaryType, title) => {
          const pin = makePin({ primaryType, title, address: undefined });
          const result = getAffiliateLink(pin);

          expect(result).not.toBeNull();

          const category = getCategoryForType(primaryType);
          expect(category).not.toBeNull();

          const url = new URL(result!.url);
          const searchParam = url.searchParams.get(category!.paramKey);
          expect(searchParam).toBe(title);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Property 2b — Null Return
// **Validates: Requirements 3.2**
//
// For all Pins with missing or unrecognized primaryType,
// getAffiliateLink returns null
// ===================================================================

describe('Preservation Property 2b: Null Return', () => {
  it('returns null when primaryType is undefined', () => {
    fc.assert(
      fc.property(titleArb, (title) => {
        const pin = makePin({ title, primaryType: undefined });
        expect(getAffiliateLink(pin)).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('returns null when primaryType does not contain any recognized keyword', () => {
    fc.assert(
      fc.property(
        unrecognizedPrimaryTypeArb,
        titleArb,
        (primaryType, title) => {
          const pin = makePin({ primaryType, title });
          expect(getAffiliateLink(pin)).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Property 2c — Metadata Fields
// **Validates: Requirements 3.3, 3.4**
//
// For all Pins with a recognized primaryType, platformName, label,
// and bgColor match the expected category mapping
// ===================================================================

describe('Preservation Property 2c: Metadata Fields', () => {
  it('returns correct platformName, label, and bgColor for each recognized type', () => {
    fc.assert(
      fc.property(
        recognizedKeywordArb,
        titleArb,
        fc.option(addressWithCityArb, { nil: undefined }),
        (primaryType, title, address) => {
          const pin = makePin({ primaryType, title, address });
          const result = getAffiliateLink(pin);

          expect(result).not.toBeNull();

          const category = getCategoryForType(primaryType);
          expect(category).not.toBeNull();

          expect(result!.platformName).toBe(category!.platformName);
          expect(result!.label).toBe(category!.label);
          expect(result!.bgColor).toBe(category!.bgColor);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Property 2d — URL Validity
// **Validates: Requirements 3.5**
//
// For all Pins with a recognized primaryType (with or without address),
// new URL(result.url) does not throw
// ===================================================================

describe('Preservation Property 2d: URL Validity', () => {
  it('produces a parseable URL for recognized types with or without address', () => {
    fc.assert(
      fc.property(
        recognizedKeywordArb,
        titleArb,
        fc.option(addressWithCityArb, { nil: undefined }),
        (primaryType, title, address) => {
          const pin = makePin({ primaryType, title, address });
          const result = getAffiliateLink(pin);

          expect(result).not.toBeNull();
          expect(() => new URL(result!.url)).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});
