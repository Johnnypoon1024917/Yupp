import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import useTravelPinStore from '@/store/useTravelPinStore';
import { getLocalData, buildCollectionIdMap, remapPinCollectionIds } from '@/hooks/useCloudSync';
import type { Pin, Collection } from '@/types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const safeDate = fc.integer({ min: 946684800000, max: 1893456000000 }).map((ts) => new Date(ts));

const pinArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  imageUrl: fc.webUrl(),
  sourceUrl: fc.webUrl(),
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
  collectionId: fc.uuid(),
  createdAt: safeDate.map((d) => d.toISOString()),
});

const collectionArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  createdAt: safeDate.map((d) => d.toISOString()),
});

// ===================================================================
// Property 1 — setCloudData replaces store contents exactly
// **Validates: Requirements 7.5**
// ===================================================================

describe('Feature: supabase-cloud-bridge, Property 1: setCloudData replaces store contents exactly', () => {
  beforeEach(() => {
    useTravelPinStore.setState({ pins: [], collections: [] });
  });

  it('store pins and collections deeply equal the provided arrays after setCloudData', () => {
    fc.assert(
      fc.property(
        fc.array(pinArb, { minLength: 0, maxLength: 20 }),
        fc.array(collectionArb, { minLength: 0, maxLength: 10 }),
        (pins: Pin[], collections: Collection[]) => {
          // Seed store with some pre-existing data to ensure replacement
          useTravelPinStore.setState({
            pins: [{ id: 'old', title: 'old', imageUrl: '', sourceUrl: '', latitude: 0, longitude: 0, collectionId: 'x', createdAt: '' }],
            collections: [{ id: 'old', name: 'old', createdAt: '' }],
          });

          const { setCloudData } = useTravelPinStore.getState();
          setCloudData(pins, collections);

          const state = useTravelPinStore.getState();
          expect(state.pins).toEqual(pins);
          expect(state.collections).toEqual(collections);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ===================================================================
// Property 2 — Local data detection identifies items without user_id
// **Validates: Requirements 8.3**
// ===================================================================

describe('Feature: supabase-cloud-bridge, Property 2: Local data detection identifies items without user_id', () => {
  /** Pin with an optional user_id field */
  const pinWithOptionalUserId = fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    imageUrl: fc.webUrl(),
    sourceUrl: fc.webUrl(),
    latitude: fc.double({ min: -90, max: 90, noNaN: true }),
    longitude: fc.double({ min: -180, max: 180, noNaN: true }),
    collectionId: fc.uuid(),
    createdAt: safeDate.map((d) => d.toISOString()),
    user_id: fc.option(fc.uuid(), { nil: undefined }),
  });

  /** Collection with an optional user_id field */
  const collectionWithOptionalUserId = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    createdAt: safeDate.map((d) => d.toISOString()),
    user_id: fc.option(fc.uuid(), { nil: undefined }),
  });

  it('getLocalData returns exactly the items without user_id and counts are preserved', () => {
    fc.assert(
      fc.property(
        fc.array(pinWithOptionalUserId, { minLength: 0, maxLength: 20 }),
        fc.array(collectionWithOptionalUserId, { minLength: 0, maxLength: 10 }),
        (pins: Pin[], collections: Collection[]) => {
          const { localPins, localCollections } = getLocalData(pins, collections);

          // Local items are exactly those without user_id
          const expectedLocalPins = pins.filter((p) => p.user_id === undefined);
          const expectedLocalCollections = collections.filter((c) => c.user_id === undefined);

          expect(localPins).toEqual(expectedLocalPins);
          expect(localCollections).toEqual(expectedLocalCollections);

          // Count invariant: local + cloud = total
          const cloudPins = pins.filter((p) => p.user_id !== undefined);
          const cloudCollections = collections.filter((c) => c.user_id !== undefined);

          expect(localPins.length + cloudPins.length).toBe(pins.length);
          expect(localCollections.length + cloudCollections.length).toBe(collections.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ===================================================================
// Property 3 — Collection ID mapping is bijective
// **Validates: Requirements 9.1**
// ===================================================================

describe('Feature: supabase-cloud-bridge, Property 3: Collection ID mapping is bijective', () => {
  it('map has one entry per local collection and no two local IDs map to the same cloud ID', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 15 })
          .chain((localIds) => {
            // Ensure unique local IDs
            const uniqueLocalIds = [...new Set(localIds)];
            const localCollections: Collection[] = uniqueLocalIds.map((id) => ({
              id,
              name: `col-${id.slice(0, 8)}`,
              createdAt: new Date().toISOString(),
            }));

            // Generate the same number of unique cloud IDs
            return fc
              .array(fc.uuid(), { minLength: uniqueLocalIds.length, maxLength: uniqueLocalIds.length })
              .map((cloudIds) => {
                const cloudCollections = cloudIds.map((id) => ({ id }));
                return { localCollections, cloudCollections };
              });
          }),
        ({ localCollections, cloudCollections }) => {
          const map = buildCollectionIdMap(localCollections, cloudCollections);

          // Exactly one entry per local collection
          expect(map.size).toBe(localCollections.length);

          // Every local ID is in the map
          for (const lc of localCollections) {
            expect(map.has(lc.id)).toBe(true);
          }

          // No two local IDs map to the same cloud ID (bijective)
          const cloudValues = [...map.values()];
          const uniqueCloudValues = new Set(cloudValues);
          expect(uniqueCloudValues.size).toBe(cloudValues.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ===================================================================
// Property 4 — Pin collection IDs are correctly remapped
// **Validates: Requirements 9.2, 9.3**
// ===================================================================

describe('Feature: supabase-cloud-bridge, Property 4: Pin collection IDs are correctly remapped', () => {
  it('pins with mapped collectionIds get the mapped value; unmapped ones get the unorganized ID', () => {
    fc.assert(
      fc.property(
        fc.array(pinArb, { minLength: 1, maxLength: 20 }),
        fc.array(
          fc.tuple(fc.uuid(), fc.uuid()),
          { minLength: 0, maxLength: 10 },
        ),
        fc.uuid(),
        (pins: Pin[], mappingEntries: [string, string][], unorganizedCloudId: string) => {
          const idMap = new Map<string, string>(mappingEntries);

          const result = remapPinCollectionIds(pins, idMap, unorganizedCloudId);

          expect(result.length).toBe(pins.length);

          for (let i = 0; i < pins.length; i++) {
            const original = pins[i];
            const remapped = result[i];

            if (idMap.has(original.collectionId)) {
              expect(remapped.collectionId).toBe(idMap.get(original.collectionId));
            } else {
              expect(remapped.collectionId).toBe(unorganizedCloudId);
            }

            // All other fields should be preserved
            expect(remapped.id).toBe(original.id);
            expect(remapped.title).toBe(original.title);
            expect(remapped.latitude).toBe(original.latitude);
            expect(remapped.longitude).toBe(original.longitude);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
