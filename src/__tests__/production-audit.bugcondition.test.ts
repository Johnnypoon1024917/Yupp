import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

// Mock localStorage for zustand persist middleware
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

/**
 * Bug Condition Exploration Tests — Property 1: Production Audit Multi-Bug Exploration
 *
 * EXPECTED TO FAIL on unfixed code — failure confirms the bugs exist.
 * DO NOT attempt to fix the tests or the code when they fail.
 *
 * _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.9, 1.10_
 */

// ─── 1.1 Leaked API Key ───────────────────────────────────────────────────────

describe('Bug 1.1 — Leaked API Key in .env.local.example', () => {
  /**
   * **Validates: Requirements 1.1**
   *
   * Assert `.env.local.example` contains no bare API key strings outside
   * variable assignments. Line 22 currently contains
   * `AIzaSyDv99fpuGYfovsEsWQub4Rk_S9PS-8_XTY` as a bare string.
   */
  it('should contain no bare API key strings outside variable assignments', () => {
    const envExample = fs.readFileSync(
      path.resolve(__dirname, '../../.env.local.example'),
      'utf-8',
    );

    const lines = envExample.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('#')) continue;
      // Valid lines are VAR=value assignments
      // A bare string (no '=' sign) that looks like an API key is a leak
      expect(trimmed).toMatch(/^[A-Z_]+=.*/);
    }
  });
});

// ─── 1.2 removePin Missing Cloud Delete ───────────────────────────────────────

describe('Bug 1.2 — removePin Missing Cloud Delete', () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * For any authenticated user calling `removePin(pinId)`, assert a Supabase
   * `delete` is issued on the `pins` table. Currently only local state is filtered.
   */
  it('should issue a Supabase delete when an authenticated user removes a pin', async () => {
    // Reset modules to get fresh store
    vi.resetModules();

    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const fromMock = vi.fn().mockReturnValue({ delete: deleteMock });

    vi.doMock('@/utils/supabase/client', () => ({
      createClient: () => ({ from: fromMock }),
    }));

    // Mock uuid
    vi.doMock('uuid', () => ({
      v4: () => 'test-uuid-1234',
    }));

    const { default: useTravelPinStore } = await import(
      '@/store/useTravelPinStore'
    );

    const fakeUser = { id: 'user-123', email: 'test@test.com' };
    const fakePin = {
      id: 'pin-to-remove',
      title: 'Test Pin',
      imageUrl: 'https://example.com/img.jpg',
      sourceUrl: 'https://example.com',
      latitude: 0,
      longitude: 0,
      collectionId: 'unorganized',
      createdAt: new Date().toISOString(),
    };

    // Set up store with an authenticated user and a pin
    useTravelPinStore.setState({
      user: fakeUser as any,
      pins: [fakePin],
      collections: [{ id: 'unorganized', name: 'Unorganized', createdAt: new Date(0).toISOString() }],
    });

    // Call removePin
    useTravelPinStore.getState().removePin('pin-to-remove');

    // Allow microtasks to flush
    await new Promise((r) => setTimeout(r, 50));

    // Assert: pin removed from local state
    expect(useTravelPinStore.getState().pins).toHaveLength(0);

    // Assert: Supabase delete was called on 'pins' table
    expect(fromMock).toHaveBeenCalledWith('pins');
    expect(deleteMock).toHaveBeenCalled();
  });

  /**
   * **Validates: Requirements 1.2**
   *
   * Property: for any pinId, an authenticated removePin must trigger a Supabase delete.
   */
  it('property: for any pinId, authenticated removePin triggers Supabase delete', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (pinId) => {
          vi.resetModules();

          const deleteMock = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          });
          const fromMock = vi.fn().mockReturnValue({ delete: deleteMock });

          vi.doMock('@/utils/supabase/client', () => ({
            createClient: () => ({ from: fromMock }),
          }));
          vi.doMock('uuid', () => ({ v4: () => 'test-uuid' }));

          const { default: store } = await import('@/store/useTravelPinStore');

          store.setState({
            user: { id: 'user-1' } as any,
            pins: [{
              id: pinId,
              title: 'Pin',
              imageUrl: 'https://example.com/img.jpg',
              sourceUrl: 'https://example.com',
              latitude: 0,
              longitude: 0,
              collectionId: 'unorganized',
              createdAt: new Date().toISOString(),
            }],
            collections: [{ id: 'unorganized', name: 'Unorganized', createdAt: new Date(0).toISOString() }],
          });

          store.getState().removePin(pinId);
          await new Promise((r) => setTimeout(r, 50));

          expect(fromMock).toHaveBeenCalledWith('pins');
          expect(deleteMock).toHaveBeenCalled();
        },
      ),
      { numRuns: 5 },
    );
  });
});


// ─── 1.3 removePinFromDay Missing Dirty Flag ─────────────────────────────────

describe('Bug 1.3 — removePinFromDay Missing Dirty Flag', () => {
  /**
   * **Validates: Requirements 1.3**
   *
   * For any (dayNumber, pinId), assert `removePinFromDay` sets
   * `hasUnsavedChanges = true`. Currently it does not.
   */
  it('should set hasUnsavedChanges to true when removing a pin from a day', async () => {
    vi.resetModules();

    vi.doMock('@/utils/supabase/client', () => ({
      createClient: () => ({}),
    }));
    vi.doMock('uuid', () => ({ v4: () => 'test-uuid' }));

    const { default: usePlannerStore } = await import(
      '@/store/usePlannerStore'
    );

    // Set up store with a pin in day 1 and hasUnsavedChanges = false
    usePlannerStore.setState({
      dayItems: {
        1: [{
          id: 'pin-1',
          title: 'Test Pin',
          imageUrl: 'https://example.com/img.jpg',
          sourceUrl: 'https://example.com',
          latitude: 0,
          longitude: 0,
          collectionId: 'unorganized',
          createdAt: new Date().toISOString(),
          day_number: 1,
          sort_order: 0,
          itinerary_item_id: 'item-1',
        }],
      },
      hasUnsavedChanges: false,
    });

    // Call removePinFromDay
    usePlannerStore.getState().removePinFromDay(1, 'pin-1');

    // Assert: hasUnsavedChanges should be true
    expect(usePlannerStore.getState().hasUnsavedChanges).toBe(true);
  });

  /**
   * **Validates: Requirements 1.3**
   *
   * Property: for any (dayNumber, pinId), removePinFromDay sets hasUnsavedChanges = true.
   */
  it('property: for any (dayNumber, pinId), removePinFromDay sets dirty flag', async () => {
    vi.resetModules();

    vi.doMock('@/utils/supabase/client', () => ({
      createClient: () => ({}),
    }));
    vi.doMock('uuid', () => ({ v4: () => 'test-uuid' }));

    const { default: usePlannerStore } = await import(
      '@/store/usePlannerStore'
    );

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.uuid(),
        async (dayNumber, pinId) => {
          usePlannerStore.setState({
            dayItems: {
              [dayNumber]: [{
                id: pinId,
                title: 'Pin',
                imageUrl: 'https://example.com/img.jpg',
                sourceUrl: 'https://example.com',
                latitude: 0,
                longitude: 0,
                collectionId: 'unorganized',
                createdAt: new Date().toISOString(),
                day_number: dayNumber,
                sort_order: 0,
                itinerary_item_id: 'item-1',
              }],
            },
            hasUnsavedChanges: false,
          });

          usePlannerStore.getState().removePinFromDay(dayNumber, pinId);
          expect(usePlannerStore.getState().hasUnsavedChanges).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ─── 1.4 buildCollectionIdMap Index-Based Mapping ─────────────────────────────

describe('Bug 1.4 — buildCollectionIdMap Index-Based Mapping', () => {
  /**
   * **Validates: Requirements 1.4**
   *
   * For any (localCollections, cloudCollections) where Postgres return order
   * differs from insert order, assert mapping uses name-based matching.
   * Currently uses index `localCollections[i] → cloudCollections[i]`.
   */
  it('should map collections by name, not by index', async () => {
    vi.resetModules();

    // We need to import the function. It's not exported, so we read the source
    // and test the logic directly.
    const source = fs.readFileSync(
      path.resolve(__dirname, '../hooks/useCloudSync.ts'),
      'utf-8',
    );

    // Extract buildCollectionIdMap function and evaluate it
    // The bug: index-based mapping means if cloud returns in different order,
    // the mapping is wrong.
    const localCollections = [
      { id: 'local-food', name: 'Food', createdAt: new Date().toISOString() },
      { id: 'local-hotels', name: 'Hotels', createdAt: new Date().toISOString() },
    ];

    // Cloud collections returned in REVERSED order (Postgres doesn't guarantee order)
    const cloudCollections = [
      { id: 'cloud-hotels', name: 'Hotels' },
      { id: 'cloud-food', name: 'Food' },
    ];

    // With index-based mapping (the bug):
    //   local-food → cloud-hotels (WRONG! should be cloud-food)
    //   local-hotels → cloud-food (WRONG! should be cloud-hotels)
    //
    // With name-based mapping (correct):
    //   local-food → cloud-food
    //   local-hotels → cloud-hotels

    // We test by checking the source code uses name-based matching
    // The function should reference .name for matching, not just index
    const functionBody = source.match(
      /function buildCollectionIdMap\([^)]*\)[^{]*\{([\s\S]*?)\n\}/,
    );
    expect(functionBody).not.toBeNull();

    const body = functionBody![1];
    // The correct implementation should match by name
    // The buggy implementation uses index: localCollections[i] → cloudCollections[i]
    // Assert it does NOT use pure index-based mapping
    expect(body).toMatch(/\.name/);
  });

  /**
   * **Validates: Requirements 1.4**
   *
   * Property: for any pair of local/cloud collections with shuffled order,
   * the mapping should pair by name, not by position.
   */
  it('property: shuffled cloud order should still produce correct name-based mapping', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            localId: fc.uuid(),
            cloudId: fc.uuid(),
            name: fc.stringMatching(/^[A-Za-z]{3,15}$/),
          }),
          { minLength: 2, maxLength: 5 },
        ),
        (entries) => {
          // Ensure unique names
          const names = new Set(entries.map((e) => e.name));
          if (names.size !== entries.length) return; // skip non-unique

          const localCollections = entries.map((e) => ({
            id: e.localId,
            name: e.name,
            createdAt: new Date().toISOString(),
          }));

          // Reverse the cloud order to simulate Postgres non-determinism
          const cloudCollections = [...entries].reverse().map((e) => ({
            id: e.cloudId,
            name: e.name,
          }));

          // The buggy index-based mapping:
          const buggyMap = new Map<string, string>();
          for (let i = 0; i < localCollections.length; i++) {
            if (i < cloudCollections.length) {
              buggyMap.set(localCollections[i].id, cloudCollections[i].id);
            }
          }

          // The correct name-based mapping:
          const correctMap = new Map<string, string>();
          for (const local of localCollections) {
            const cloud = cloudCollections.find((c) => c.name === local.name);
            if (cloud) correctMap.set(local.id, cloud.id);
          }

          // If the buggy map equals the correct map, the order happened to match.
          // With reversed order and >=2 entries, they should differ.
          // Assert the buggy map does NOT match the correct map
          // (this proves the bug exists)
          let allMatch = true;
          for (const [key, val] of correctMap) {
            if (buggyMap.get(key) !== val) {
              allMatch = false;
              break;
            }
          }

          // For reversed order with unique names and >=2 entries, they must differ
          // This assertion proves the index-based approach is wrong
          if (entries.length >= 2) {
            // The buggy approach should produce wrong results
            // We assert the CORRECT behavior: the source code should use name matching
            // Since we're testing the actual function behavior, we verify the source
            const source = fs.readFileSync(
              path.resolve(__dirname, '../hooks/useCloudSync.ts'),
              'utf-8',
            );
            const fnMatch = source.match(
              /function buildCollectionIdMap\([^)]*\)[^{]*\{([\s\S]*?)\n\}/,
            );
            expect(fnMatch).not.toBeNull();
            // Assert the function body references .name for matching
            expect(fnMatch![1]).toMatch(/\.name/);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});


// ─── 1.5 Live-Sync Hardcoded collection_id ────────────────────────────────────

describe('Bug 1.5 — Live-Sync Hardcoded collection_id', () => {
  /**
   * **Validates: Requirements 1.5**
   *
   * For any newly-added pin with a non-unorganized `collectionId`, assert the
   * Supabase insert uses the pin's actual `collectionId` resolved through the
   * collection ID map. Currently hardcodes `unorganizedCloudId`.
   */
  it('should use actual collectionId in live-sync insert, not hardcoded unorganizedCloudId', () => {
    // Read the source to verify the live-sync subscriber uses the pin's collectionId
    const source = fs.readFileSync(
      path.resolve(__dirname, '../hooks/useCloudSync.ts'),
      'utf-8',
    );

    // Find the live-sync subscriber section (the store.subscribe callback)
    // that builds pinRows for insertion
    const pinRowsSection = source.match(
      /const pinRows = newPins\.map\(\(p\) => \(\{([\s\S]*?)\}\)\)/,
    );
    expect(pinRowsSection).not.toBeNull();

    const pinRowBody = pinRowsSection![1];

    // The bug: collection_id is hardcoded to unorganizedCloudId
    // The fix: collection_id should reference p.collectionId (resolved through map)
    // Assert that collection_id does NOT use the hardcoded unorganizedCloudId
    expect(pinRowBody).not.toMatch(/collection_id:\s*unorganizedCloudId/);
  });

  /**
   * **Validates: Requirements 1.5**
   *
   * Property: for any pin with a non-unorganized collectionId, the live-sync
   * code should resolve through the collection ID map.
   */
  it('property: live-sync code should reference collection map resolution for any collectionId', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // arbitrary collectionId
        (collectionId) => {
          const source = fs.readFileSync(
            path.resolve(__dirname, '../hooks/useCloudSync.ts'),
            'utf-8',
          );

          const pinRowsSection = source.match(
            /const pinRows = newPins\.map\(\(p\) => \(\{([\s\S]*?)\}\)\)/,
          );
          expect(pinRowsSection).not.toBeNull();

          const pinRowBody = pinRowsSection![1];
          // Should NOT hardcode unorganizedCloudId for collection_id
          expect(pinRowBody).not.toMatch(/collection_id:\s*unorganizedCloudId/);
        },
      ),
      { numRuns: 5 },
    );
  });
});

// ─── 1.6 cloneItinerary FK/RLS Failure ────────────────────────────────────────

describe('Bug 1.6 — cloneItinerary FK/RLS Failure', () => {
  /**
   * **Validates: Requirements 1.6**
   *
   * For any `sourceItineraryId` owned by a different user, assert
   * `cloneItinerary` clones the underlying pins into the new user's account
   * before inserting itinerary items. Currently copies `pin_id` references directly.
   */
  it('should clone pins for a different user before inserting itinerary items', async () => {
    vi.resetModules();

    const sourceUserId = 'source-user-123';
    const currentUserId = 'current-user-456';
    const sourcePinId = 'source-pin-abc';
    const sourceItineraryId = 'source-itin-789';

    const insertedPinId = 'new-cloned-pin-id';
    const newItineraryId = 'new-itin-id';

    // Track all insert calls to verify pin cloning happens before item insertion
    const insertCalls: { table: string; data: any }[] = [];

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: currentUserId, is_anonymous: false } },
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'itineraries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: sourceItineraryId,
                    user_id: sourceUserId,
                    name: 'Test Trip',
                    trip_date: null,
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
            insert: vi.fn().mockImplementation((data: any) => {
              insertCalls.push({ table, data });
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: newItineraryId,
                      user_id: currentUserId,
                      name: 'Test Trip',
                      trip_date: null,
                      created_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        if (table === 'itinerary_items') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [{
                      id: 'item-1',
                      itinerary_id: sourceItineraryId,
                      pin_id: sourcePinId,
                      day_number: 1,
                      sort_order: 0,
                      pins: {
                        id: sourcePinId,
                        user_id: sourceUserId,
                        title: 'Source Pin',
                        image_url: 'https://example.com/img.jpg',
                        source_url: 'https://example.com',
                        latitude: 0,
                        longitude: 0,
                        collection_id: 'unorganized',
                        created_at: new Date().toISOString(),
                      },
                    }],
                    error: null,
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockImplementation((data: any) => {
              insertCalls.push({ table, data });
              return { error: null };
            }),
          };
        }
        if (table === 'pins') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{
                  id: sourcePinId,
                  user_id: sourceUserId,
                  title: 'Source Pin',
                  image_url: 'https://example.com/img.jpg',
                  source_url: 'https://example.com',
                  latitude: 0,
                  longitude: 0,
                  collection_id: 'unorganized',
                  created_at: new Date().toISOString(),
                }],
                error: null,
              }),
            }),
            insert: vi.fn().mockImplementation((data: any) => {
              insertCalls.push({ table, data });
              return {
                select: vi.fn().mockResolvedValue({
                  data: [{ id: insertedPinId, ...data }],
                  error: null,
                }),
              };
            }),
          };
        }
        return {};
      }),
    };

    vi.doMock('@/utils/supabase/client', () => ({
      createClient: () => mockSupabase,
    }));
    vi.doMock('uuid', () => ({ v4: () => 'test-uuid' }));

    const { default: usePlannerStore } = await import(
      '@/store/usePlannerStore'
    );

    await usePlannerStore.getState().cloneItinerary(sourceItineraryId);

    // Assert: pins table should have an insert BEFORE itinerary_items insert
    // (cloning pins into the new user's account)
    const pinInserts = insertCalls.filter((c) => c.table === 'pins');
    const itemInserts = insertCalls.filter((c) => c.table === 'itinerary_items');

    // The bug: no pin cloning happens at all
    expect(pinInserts.length).toBeGreaterThan(0);

    // If pin inserts exist, they should come before item inserts
    if (pinInserts.length > 0 && itemInserts.length > 0) {
      const firstPinInsertIdx = insertCalls.findIndex((c) => c.table === 'pins');
      const firstItemInsertIdx = insertCalls.findIndex((c) => c.table === 'itinerary_items');
      expect(firstPinInsertIdx).toBeLessThan(firstItemInsertIdx);
    }
  });
});

// ─── 1.9 VisualMarker DOM Exception ──────────────────────────────────────────

describe('Bug 1.9 — VisualMarker DOM Exception', () => {
  /**
   * **Validates: Requirements 1.9**
   *
   * For any scenario where `img.onerror` fires after the image element is
   * already detached from `inner`, assert no DOM exception is thrown.
   * Currently calls `inner.removeChild(img)` without guard.
   */
  it('should not throw when img.onerror fires after img is detached', async () => {
    vi.resetModules();

    // Use jsdom for DOM testing
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const { document: doc } = dom.window;

    // Temporarily set global document for the module
    const origDoc = globalThis.document;
    globalThis.document = doc as any;

    try {
      const { createVisualMarkerElement } = await import(
        '@/components/VisualMarker'
      );

      const fakePin = {
        id: 'pin-1',
        title: 'Test',
        imageUrl: 'https://example.com/broken.jpg',
        sourceUrl: 'https://example.com',
        latitude: 0,
        longitude: 0,
        collectionId: 'unorganized',
        createdAt: new Date().toISOString(),
      };

      const element = createVisualMarkerElement({
        pin: fakePin,
        onClick: () => {},
      });

      // Get the inner div and img
      const inner = element.querySelector('.visual-marker-inner') as HTMLDivElement;
      const img = inner.querySelector('img') as HTMLImageElement;

      expect(inner).not.toBeNull();
      expect(img).not.toBeNull();

      // Simulate: img is already detached from inner (e.g., by a previous error or cleanup)
      inner.removeChild(img);

      // Now fire onerror — this should NOT throw
      expect(() => {
        if (img.onerror) {
          (img.onerror as Function)(new Event('error'));
        }
      }).not.toThrow();
    } finally {
      globalThis.document = origDoc;
    }
  });

  /**
   * **Validates: Requirements 1.9**
   *
   * Property: for any pin, firing onerror after detachment should never throw.
   */
  it('property: onerror after detachment never throws for any pin', async () => {
    vi.resetModules();

    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const { document: doc } = dom.window;

    const origDoc = globalThis.document;
    globalThis.document = doc as any;

    try {
      const { createVisualMarkerElement } = await import(
        '@/components/VisualMarker'
      );

      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 50 }),
            imageUrl: fc.webUrl(),
            sourceUrl: fc.webUrl(),
            latitude: fc.double({ min: -90, max: 90, noNaN: true }),
            longitude: fc.double({ min: -180, max: 180, noNaN: true }),
          }),
          (pinData) => {
            const pin = {
              ...pinData,
              collectionId: 'unorganized',
              createdAt: new Date().toISOString(),
            };

            const element = createVisualMarkerElement({
              pin,
              onClick: () => {},
            });

            const inner = element.querySelector('.visual-marker-inner') as HTMLDivElement;
            const img = inner?.querySelector('img') as HTMLImageElement;

            if (inner && img && img.parentNode === inner) {
              // Detach img first
              inner.removeChild(img);

              // Fire onerror — must not throw
              expect(() => {
                if (img.onerror) {
                  (img.onerror as Function)(new Event('error'));
                }
              }).not.toThrow();
            }
          },
        ),
        { numRuns: 10 },
      );
    } finally {
      globalThis.document = origDoc;
    }
  });
});

// ─── 1.10 extractPlaces Missing Server Directive ──────────────────────────────

describe('Bug 1.10 — extractPlaces Missing Server Directive', () => {
  /**
   * **Validates: Requirements 1.10**
   *
   * Assert `extractPlaces.ts` starts with `'use server'` directive.
   * Currently missing.
   */
  it('should start with "use server" directive', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../actions/extractPlaces.ts'),
      'utf-8',
    );

    // The first non-empty, non-comment line should be 'use server'
    const lines = source.split('\n');
    const firstMeaningfulLine = lines
      .map((l) => l.trim())
      .find((l) => l !== '' && !l.startsWith('//'));

    expect(firstMeaningfulLine).toMatch(/^['"]use server['"]/);
  });

  /**
   * **Validates: Requirements 1.10**
   *
   * Property: the file must always begin with the server directive regardless
   * of how many times we read it.
   */
  it('property: extractPlaces.ts consistently starts with use server', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // no random input needed, just repeated assertion
        () => {
          const source = fs.readFileSync(
            path.resolve(__dirname, '../actions/extractPlaces.ts'),
            'utf-8',
          );

          const trimmed = source.trimStart();
          expect(trimmed).toMatch(/^['"]use server['"]/);
        },
      ),
      { numRuns: 3 },
    );
  });
});
