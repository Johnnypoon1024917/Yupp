import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  filterPins,
  groupPinsByRegion,
  extractRegion,
} from '@/components/planner/SavedLibrary';
import type { Pin } from '@/types';

/**
 * Preservation Property Tests for SavedLibrary pure functions
 * Validates: Requirements 3.6
 *
 * These tests capture the baseline behavior of filterPins, groupPinsByRegion,
 * and extractRegion on UNFIXED code. They must PASS before and after the fix.
 */

// Avoid generating strings that collide with Object.prototype property names
const safeStringArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter(
    (s) =>
      !Object.prototype.hasOwnProperty.call(Object.prototype, s.trim()) &&
      s.trim().length > 0
  );

const pinArb: fc.Arbitrary<Pin> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
  imageUrl: fc.constant('https://example.com/img.jpg'),
  sourceUrl: fc.constant('https://example.com'),
  collectionId: fc.constant('unorganized'),
  createdAt: fc.constant(new Date().toISOString()),
  address: fc.option(
    fc.array(safeStringArb, {
      minLength: 1,
      maxLength: 4,
    }).map((parts) => parts.join(', ')),
    { nil: undefined }
  ),
});

const pinsArb = fc.array(pinArb, { minLength: 0, maxLength: 20 });

describe('filterPins — preservation properties', () => {
  it('Property 1: filterPins with empty query returns all pins', () => {
    fc.assert(
      fc.property(pinsArb, (pins) => {
        const result = filterPins(pins, '');
        expect(result).toHaveLength(pins.length);
        expect(result).toEqual(pins);
      })
    );
  });

  it('Property 2: every pin in filterPins result has query in title or address (case-insensitive)', () => {
    // Only test with non-whitespace queries since whitespace-only queries are treated as empty
    const nonEmptyQueryArb = fc
      .string({ minLength: 1, maxLength: 10 })
      .filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(pinsArb, nonEmptyQueryArb, (pins, query) => {
        const result = filterPins(pins, query);
        const lower = query.toLowerCase();
        for (const pin of result) {
          const titleMatch = pin.title.toLowerCase().includes(lower);
          const addressMatch =
            pin.address != null &&
            pin.address.toLowerCase().includes(lower);
          expect(titleMatch || addressMatch).toBe(true);
        }
      })
    );
  });

  it('Property 3: filterPins result is always a subset of the input array', () => {
    fc.assert(
      fc.property(
        pinsArb,
        fc.string({ minLength: 0, maxLength: 10 }),
        (pins, query) => {
          const result = filterPins(pins, query);
          expect(result.length).toBeLessThanOrEqual(pins.length);
          for (const pin of result) {
            expect(pins).toContain(pin);
          }
        }
      )
    );
  });
});

describe('groupPinsByRegion — preservation properties', () => {
  it('Property 4: total pin count across all groups equals input count', () => {
    fc.assert(
      fc.property(pinsArb, (pins) => {
        const groups = groupPinsByRegion(pins);
        const total = Object.values(groups).reduce(
          (sum, arr) => sum + arr.length,
          0
        );
        expect(total).toBe(pins.length);
      })
    );
  });

  it('Property 5: every pin in a group has the same extractRegion value as the group key', () => {
    fc.assert(
      fc.property(pinsArb, (pins) => {
        const groups = groupPinsByRegion(pins);
        for (const [key, groupPins] of Object.entries(groups)) {
          for (const pin of groupPins) {
            expect(extractRegion(pin.address)).toBe(key);
          }
        }
      })
    );
  });
});

describe('extractRegion — preservation properties', () => {
  it('Property 6: extractRegion(undefined) returns "Unknown Location"', () => {
    expect(extractRegion(undefined)).toBe('Unknown Location');
  });

  it('Property 7: extractRegion("") returns "Unknown Location"', () => {
    expect(extractRegion('')).toBe('Unknown Location');
  });

  it('Property 8: for non-empty addresses with commas, returns last comma-separated segment trimmed', () => {
    // Generate segments without commas, where the last one has non-empty trimmed content
    const segmentArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => !s.includes(','));

    const nonEmptyLastSegmentArb = segmentArb.filter(
      (s) => s.trim().length > 0
    );

    fc.assert(
      fc.property(
        fc.array(segmentArb, { minLength: 1, maxLength: 4 }),
        nonEmptyLastSegmentArb,
        (prefixSegments, lastSegment) => {
          const address = [...prefixSegments, lastSegment].join(', ');
          const result = extractRegion(address);
          expect(result).toBe(lastSegment.trim());
        }
      )
    );
  });
});
