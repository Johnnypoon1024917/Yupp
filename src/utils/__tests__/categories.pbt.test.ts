import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getCollectionForType, getKnownCollectionNames } from '../categories';

// ---------------------------------------------------------------------------
// Known mapped primaryType values (exhaustive list from the design doc)
// ---------------------------------------------------------------------------

const MAPPED_TYPES = [
  'restaurant',
  'cafe',
  'bar',
  'bakery',
  'hotel',
  'lodging',
  'apartment',
  'tourist_attraction',
  'museum',
  'park',
  'zoo',
  'shopping_mall',
  'store',
];

// ===================================================================
// Feature: smart-pin-organizer, Property 1: Closed-world mapping with unknown fallback
// **Validates: Requirements 1.5, 1.7**
// ===================================================================

describe('Feature: smart-pin-organizer, Property 1: Closed-world mapping with unknown fallback', () => {
  const knownNames = getKnownCollectionNames();

  it('for any arbitrary string, getCollectionForType returns a value in the known set', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = getCollectionForType(input);
        expect(knownNames.has(result)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('for any string that is NOT a mapped primaryType, getCollectionForType returns "Unorganized"', () => {
    const unmappedStringArb = fc
      .string()
      .filter((s) => !MAPPED_TYPES.includes(s));

    fc.assert(
      fc.property(unmappedStringArb, (input) => {
        expect(getCollectionForType(input)).toBe('Unorganized');
      }),
      { numRuns: 100 },
    );
  });

  it('for undefined input, getCollectionForType returns "Unorganized"', () => {
    expect(getCollectionForType(undefined)).toBe('Unorganized');
  });
});
