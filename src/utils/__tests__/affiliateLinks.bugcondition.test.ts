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
// Category → paramKey mapping for assertions
// ---------------------------------------------------------------------------

interface CategoryInfo {
  keywords: string[];
  paramKey: string;
  platformName: string;
}

const CATEGORIES: CategoryInfo[] = [
  { keywords: ['hotel', 'lodging'], paramKey: 'ss', platformName: 'Booking.com' },
  { keywords: ['restaurant', 'food', 'cafe'], paramKey: 'q', platformName: 'TripAdvisor' },
  { keywords: ['tourist_attraction', 'museum', 'park'], paramKey: 'query', platformName: 'Klook' },
];

function getCategoryForType(primaryType: string): CategoryInfo | null {
  return CATEGORIES.find((cat) => cat.keywords.some((kw) => primaryType.includes(kw))) ?? null;
}

/**
 * Builds the "correct" URL using URL/URLSearchParams API.
 * This is what the fixed code should produce.
 */
function buildExpectedUrl(baseUrl: string, paramKey: string, searchValue: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set(paramKey, searchValue);
  return url.toString();
}

const BASE_URLS: Record<string, string> = {
  ss: 'https://www.booking.com/searchresults.html',
  q: 'https://www.tripadvisor.com/Search',
  query: 'https://www.klook.com/search/',
};

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
// Bug Condition Exploration Test
// **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
//
// EXPECTED: These tests FAIL on unfixed code — failure confirms the bug.
//
// The bug: getAffiliateLink manually encodeURIComponent()s title and city,
// then concatenates with a literal "+". This produces URLs where spaces
// within title/city are encoded as %20 (from encodeURIComponent) but the
// separator between title and city is a raw "+". The correct behavior
// (using URL/URLSearchParams) would encode ALL spaces uniformly as "+".
//
// searchParams.get() masks this because it decodes both %20 and + as space.
// So we assert on the raw URL string: the result URL must match what
// URL/URLSearchParams would produce for the same search value.
// ===================================================================

describe('Bug Condition: Affiliate Link URL Encoding with Title+City', () => {
  // -----------------------------------------------------------------
  // Concrete test cases from the design document
  // -----------------------------------------------------------------

  it('CJK title with space: URL search string must match URLSearchParams encoding', () => {
    const pin = makePin({
      title: '瀧宴 日本料理',
      address: '123 Main St, 銅鑼灣, Hong Kong',
      primaryType: 'restaurant',
    });

    const result = getAffiliateLink(pin);
    expect(result).not.toBeNull();

    const searchValue = `${pin.title} ${extractCity(pin.address!)}`;
    const expectedUrl = buildExpectedUrl(BASE_URLS['q'], 'q', searchValue);

    // The raw URL must match what URLSearchParams would produce
    // Buggy code uses encodeURIComponent (spaces → %20) + literal "+"
    // Fixed code uses URLSearchParams (spaces → +) uniformly
    expect(result!.url).toBe(expectedUrl);
  });

  it('English multi-word title: URL search string must match URLSearchParams encoding', () => {
    const pin = makePin({
      title: 'The Grand Hotel',
      address: '100 Broadway, New York, USA',
      primaryType: 'hotel',
    });

    const result = getAffiliateLink(pin);
    expect(result).not.toBeNull();

    const searchValue = `${pin.title} ${extractCity(pin.address!)}`;
    const expectedUrl = buildExpectedUrl(BASE_URLS['ss'], 'ss', searchValue);

    // The raw URL must match what URLSearchParams would produce
    // Buggy code: ?ss=The%20Grand%20Hotel+New%20York
    // Fixed code: ?ss=The+Grand+Hotel+New+York
    expect(result!.url).toBe(expectedUrl);
  });

  it('Special characters title: URL search string must match URLSearchParams encoding', () => {
    const pin = makePin({
      title: 'Café & Bar',
      address: '1 Rue, Paris, France',
      primaryType: 'cafe',
    });

    const result = getAffiliateLink(pin);
    expect(result).not.toBeNull();

    const searchValue = `${pin.title} ${extractCity(pin.address!)}`;
    const expectedUrl = buildExpectedUrl(BASE_URLS['q'], 'q', searchValue);

    // The raw URL must match what URLSearchParams would produce
    expect(result!.url).toBe(expectedUrl);
  });

  // -----------------------------------------------------------------
  // Property-based test: for ALL Pins with recognized primaryType + address,
  // the generated URL must match what URL/URLSearchParams would produce
  // -----------------------------------------------------------------

  it('PBT: for any Pin with recognized primaryType and address, URL matches URLSearchParams encoding', () => {
    fc.assert(
      fc.property(
        recognizedKeywordArb,
        titleArb,
        addressWithCityArb,
        (primaryType, title, address) => {
          const pin = makePin({ primaryType, title, address });
          const result = getAffiliateLink(pin);

          expect(result).not.toBeNull();

          const category = getCategoryForType(primaryType);
          expect(category).not.toBeNull();

          const searchValue = `${pin.title} ${extractCity(pin.address!)}`;
          const expectedUrl = buildExpectedUrl(
            BASE_URLS[category!.paramKey],
            category!.paramKey,
            searchValue,
          );

          // The raw URL must match what URLSearchParams would produce
          expect(result!.url).toBe(expectedUrl);
        },
      ),
      { numRuns: 100 },
    );
  });
});
