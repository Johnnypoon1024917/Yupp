import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import useTravelPinStore from '@/store/useTravelPinStore';
import { getCollectionForType } from '@/utils/categories';

// ---------------------------------------------------------------------------
// Mock Supabase client to avoid real network calls in tests
// ---------------------------------------------------------------------------
vi.mock('@/utils/supabase/client', () => ({
  createClient: () => {
    const makeChain = (): any => ({
      insert: () => makeChain(),
      select: () => makeChain(),
      from: () => makeChain(),
      then: (cb: any) => cb({ data: null, error: null }),
    });
    return makeChain();
  },
}));

// ---------------------------------------------------------------------------
// Known mapped primaryType values (from the design doc)
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

// ---------------------------------------------------------------------------
// Arbitraries — smart generators for pin data
// ---------------------------------------------------------------------------

/** Generates a primaryType that is either a known mapped type, an arbitrary string, or undefined. */
const primaryTypeArb = fc.oneof(
  fc.constantFrom(...MAPPED_TYPES),
  fc.string(),
  fc.constant(undefined),
);

/** Generates minimal pin data suitable for addPin. */
const pinDataArb = fc.record({
  title: fc.string({ minLength: 1 }),
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
  sourceUrl: fc.webUrl(),
  imageUrl: fc.string(),
  primaryType: primaryTypeArb,
});

// ---------------------------------------------------------------------------
// Helper: reset store to clean initial state before each test
// ---------------------------------------------------------------------------
const DEFAULT_COLLECTION = {
  id: 'unorganized',
  name: 'Unorganized',
  createdAt: new Date(0).toISOString(),
};

function resetStore() {
  useTravelPinStore.setState({
    pins: [],
    collections: [DEFAULT_COLLECTION],
    activeCollectionId: null,
    isDrawerOpen: false,
    activePinId: null,
    user: null,
  });
}

// ===================================================================
// Feature: smart-pin-organizer, Property 2: addPin assigns correct collection name
// **Validates: Requirements 2.1, 2.3**
// ===================================================================

describe('Feature: smart-pin-organizer, Property 2: addPin assigns correct collection name', () => {
  beforeEach(resetStore);

  it('for any pin, the assigned collectionId references a collection whose name matches getCollectionForType(primaryType)', () => {
    fc.assert(
      fc.property(pinDataArb, (pinData) => {
        resetStore();

        const expectedName = getCollectionForType(pinData.primaryType);
        const newPin = useTravelPinStore.getState().addPin(pinData);

        const { collections } = useTravelPinStore.getState();
        const targetCollection = collections.find((c) => c.id === newPin.collectionId);

        expect(targetCollection).toBeDefined();
        expect(targetCollection!.name).toBe(expectedName);
      }),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Feature: smart-pin-organizer, Property 3: Collection deduplication on repeated primaryType
// **Validates: Requirements 2.2**
// ===================================================================

describe('Feature: smart-pin-organizer, Property 3: Collection deduplication on repeated primaryType', () => {
  beforeEach(resetStore);

  it('adding two pins with the same primaryType results in the same collectionId and exactly one collection with that name', () => {
    fc.assert(
      fc.property(primaryTypeArb, pinDataArb, pinDataArb, (pType, pinA, pinB) => {
        resetStore();

        const dataA = { ...pinA, primaryType: pType };
        const dataB = { ...pinB, primaryType: pType };

        const pin1 = useTravelPinStore.getState().addPin(dataA);
        const pin2 = useTravelPinStore.getState().addPin(dataB);

        // Both pins share the same collectionId
        expect(pin1.collectionId).toBe(pin2.collectionId);

        // Exactly one collection with the mapped name exists
        const expectedName = getCollectionForType(pType);
        const { collections } = useTravelPinStore.getState();
        const matchingCollections = collections.filter((c) => c.name === expectedName);
        expect(matchingCollections).toHaveLength(1);
      }),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Feature: smart-pin-organizer, Property 4: Preservation on pin addition
// **Validates: Requirements 2.5**
// ===================================================================

describe('Feature: smart-pin-organizer, Property 4: Preservation on pin addition', () => {
  beforeEach(resetStore);

  it('after each pin addition, all previous pins and collections still exist', () => {
    fc.assert(
      fc.property(fc.array(pinDataArb, { minLength: 1, maxLength: 10 }), (pinDataList) => {
        resetStore();

        const addedPinIds: string[] = [];
        const seenCollectionIds = new Set<string>();

        // Record initial collections
        useTravelPinStore.getState().collections.forEach((c) => seenCollectionIds.add(c.id));

        for (const pinData of pinDataList) {
          const newPin = useTravelPinStore.getState().addPin(pinData);
          addedPinIds.push(newPin.id);
          seenCollectionIds.add(newPin.collectionId);

          const { pins, collections } = useTravelPinStore.getState();

          // All previously added pins still exist
          for (const prevId of addedPinIds) {
            expect(pins.some((p) => p.id === prevId)).toBe(true);
          }

          // Pin count grew by exactly one
          expect(pins).toHaveLength(addedPinIds.length);

          // All previously seen collections still exist
          const currentCollectionIds = new Set(collections.map((c) => c.id));
          for (const cId of seenCollectionIds) {
            expect(currentCollectionIds.has(cId)).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Feature: smart-pin-organizer, Property 5: Referential integrity
// **Validates: Requirements 2.7**
// ===================================================================

describe('Feature: smart-pin-organizer, Property 5: Referential integrity', () => {
  beforeEach(resetStore);

  it('every pin collectionId references an existing collection', () => {
    fc.assert(
      fc.property(fc.array(pinDataArb, { minLength: 1, maxLength: 10 }), (pinDataList) => {
        resetStore();

        for (const pinData of pinDataList) {
          useTravelPinStore.getState().addPin(pinData);
        }

        const { pins, collections } = useTravelPinStore.getState();
        const collectionIds = new Set(collections.map((c) => c.id));

        for (const pin of pins) {
          expect(collectionIds.has(pin.collectionId)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
