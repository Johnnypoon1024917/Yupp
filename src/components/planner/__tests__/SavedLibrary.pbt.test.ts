import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { groupPinsByCategory, filterPins } from '@/components/planner/SavedLibrary';
import type { Pin, Collection } from '@/types';

// ---------------------------------------------------------------------------
// Arbitraries — smart generators
// ---------------------------------------------------------------------------

/** Constrained date arbitrary that stays within valid ISO range. */
const isoDateArb = fc
  .integer({ min: 946684800000, max: 1924905600000 })
  .map((ts) => new Date(ts).toISOString());

/** Generates a collection with a unique id and a human-readable name. */
const collectionArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  createdAt: isoDateArb,
});

/** Generates a non-empty array of collections with unique ids. */
const collectionsArb = fc
  .array(collectionArb, { minLength: 1, maxLength: 8 })
  .map((cols) => {
    // Ensure unique ids by appending index suffix
    return cols.map((c, i) => ({ ...c, id: `${c.id}-${i}` }));
  });

/**
 * Generates a pin whose collectionId is drawn from the provided collection ids.
 */
function pinArb(collectionIds: string[]): fc.Arbitrary<Pin> {
  return fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 0, maxLength: 40 }),
    imageUrl: fc.string(),
    sourceUrl: fc.webUrl(),
    latitude: fc.double({ min: -90, max: 90, noNaN: true }),
    longitude: fc.double({ min: -180, max: 180, noNaN: true }),
    collectionId: fc.constantFrom(...collectionIds),
    createdAt: isoDateArb,
    address: fc.option(fc.string({ minLength: 0, maxLength: 60 }), { nil: undefined }),
  }) as fc.Arbitrary<Pin>;
}

/**
 * Generates a tuple of [collections, pins] where every pin's collectionId
 * references one of the generated collections.
 */
const collectionsAndPinsArb = collectionsArb.chain((collections) =>
  fc
    .array(pinArb(collections.map((c) => c.id)), { minLength: 0, maxLength: 20 })
    .map((pins) => [collections, pins] as [Collection[], Pin[]]),
);

/** Generates a search query string (may be empty). */
const queryArb = fc.oneof(
  fc.constant(''),
  fc.string({ minLength: 1, maxLength: 15 }),
);

// ===================================================================
// Feature: smart-pin-organizer, Property 6: Category grouping is a correct partition
// **Validates: Requirements 5.3, 5.7**
// ===================================================================

describe('Feature: smart-pin-organizer, Property 6: Category grouping is a correct partition', () => {
  it('every pin appears exactly once and under the correct collection name group', () => {
    fc.assert(
      fc.property(collectionsAndPinsArb, ([collections, pins]) => {
        const groups = groupPinsByCategory(pins, collections);

        // Build a lookup from collection id → collection name
        const idToName = new Map(collections.map((c) => [c.id, c.name]));

        // (c) Total count across all groups equals input count
        const allGroupedPins = Object.values(groups).flat();
        expect(allGroupedPins).toHaveLength(pins.length);

        // (a) Every input pin appears in exactly one group
        const seenIds = new Set<string>();
        for (const [groupKey, groupPins] of Object.entries(groups)) {
          for (const pin of groupPins) {
            // No duplicate appearances
            expect(seenIds.has(pin.id)).toBe(false);
            seenIds.add(pin.id);

            // (b) The group key matches the collection name for that pin's collectionId
            const expectedName = idToName.get(pin.collectionId) ?? 'Unknown';
            expect(groupKey).toBe(expectedName);
          }
        }

        // Every input pin was seen
        expect(seenIds.size).toBe(pins.length);
      }),
      { numRuns: 100 },
    );
  });
});


// ===================================================================
// Feature: smart-pin-organizer, Property 7: Filter-before-group commutativity
// **Validates: Requirements 5.6**
// ===================================================================

describe('Feature: smart-pin-organizer, Property 7: Filter-before-group commutativity', () => {
  it('no pin excluded by the filter appears in any group after filter-then-group', () => {
    fc.assert(
      fc.property(collectionsAndPinsArb, queryArb, ([collections, pins], query) => {
        const filteredPins = filterPins(pins, query);
        const groups = groupPinsByCategory(filteredPins, collections);

        // Determine which pins were excluded by the filter
        const filteredIds = new Set(filteredPins.map((p) => p.id));
        const excludedPins = pins.filter((p) => !filteredIds.has(p.id));

        // Collect all pin ids present in the grouped result
        const groupedIds = new Set(
          Object.values(groups)
            .flat()
            .map((p) => p.id),
        );

        // No excluded pin should appear in any group
        for (const excluded of excludedPins) {
          expect(groupedIds.has(excluded.id)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
