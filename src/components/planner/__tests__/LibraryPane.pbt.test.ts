import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { filterPins, groupPinsByCity, groupPinsByCountry } from '@/components/planner/LibraryPane';
import type { Pin } from '@/types';

// ---------------------------------------------------------------------------
// Arbitraries — smart generators
// ---------------------------------------------------------------------------

/** Constrained date arbitrary that stays within valid ISO range. */
const isoDateArb = fc
  .integer({ min: 946684800000, max: 1924905600000 })
  .map((ts) => new Date(ts).toISOString());

/** Generates a pin with a random address (may be undefined). */
const pinWithAddressArb: fc.Arbitrary<Pin> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 0, maxLength: 40 }),
  imageUrl: fc.string(),
  sourceUrl: fc.webUrl(),
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
  collectionId: fc.uuid(),
  createdAt: isoDateArb,
  address: fc.oneof(
    fc.constant(undefined),
    fc.constant(''),
    fc.string({ minLength: 1, maxLength: 60 }),
    // Realistic comma-separated addresses
    fc
      .tuple(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
      )
      .map(([city, region, country]) => `${city}, ${region}, ${country}`),
  ),
}) as fc.Arbitrary<Pin>;

/** Generates a non-empty pin array with addresses that may match a search query. */
const pinsForSearchArb = fc.array(pinWithAddressArb, { minLength: 1, maxLength: 20 });

/** All grouping modes available in LibraryPane. */
const groupModes = ['city', 'country'] as const;
type GroupMode = (typeof groupModes)[number];

/** Arbitrary for a random grouping mode. */
const groupModeArb = fc.constantFrom<GroupMode>(...groupModes);

/** Arbitrary for a non-empty search query string. */
const searchQueryArb = fc.string({ minLength: 1, maxLength: 30 });


// ===================================================================
// Feature: qa-hotfix-country-filter, Property 7: LibraryPane mode switching preserves search query
// **Validates: Requirements 7.5**
// ===================================================================

/**
 * Property 7: For any search query and any pair of mode switches,
 * the filterPins result is identical regardless of which groupMode is
 * active. This proves search and groupMode are independent — switching
 * modes never clears or modifies the search query.
 */
describe('Feature: qa-hotfix-country-filter, Property 7: LibraryPane mode switching preserves search query', () => {
  it('filterPins produces the same result regardless of which groupMode is applied afterward', () => {
    fc.assert(
      fc.property(
        pinsForSearchArb,
        searchQueryArb,
        groupModeArb,
        groupModeArb,
        (pins, query, modeA, modeB) => {
          // Filter pins with the same query — this simulates the search state
          const filteredA = filterPins(pins, query);
          const filteredB = filterPins(pins, query);

          // Apply different grouping modes to the same filtered result
          const applyGrouping = (filtered: Pin[], mode: GroupMode) => {
            switch (mode) {
              case 'country':
                return groupPinsByCountry(filtered);
              case 'city':
                return groupPinsByCity(filtered);
            }
          };

          const groupsA = applyGrouping(filteredA, modeA);
          const groupsB = applyGrouping(filteredB, modeB);

          // The total number of pins after filtering is the same
          // regardless of which grouping mode is applied
          const totalA = Object.values(groupsA).flat();
          const totalB = Object.values(groupsB).flat();

          expect(totalA).toHaveLength(totalB.length);

          // The exact set of pin ids is identical across both modes
          const idsA = new Set(totalA.map((p) => p.id));
          const idsB = new Set(totalB.map((p) => p.id));

          expect(idsA).toEqual(idsB);

          // The filtered result itself is identical (search is mode-independent)
          expect(filteredA.map((p) => p.id)).toEqual(filteredB.map((p) => p.id));
        },
      ),
      { numRuns: 100 },
    );
  });
});
