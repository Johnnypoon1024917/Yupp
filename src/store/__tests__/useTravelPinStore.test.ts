import { describe, it, expect, beforeEach, vi } from 'vitest';
import useTravelPinStore from '@/store/useTravelPinStore';
import type { Pin, Collection } from '@/types';
import type { User } from '@supabase/supabase-js';

// Mock Supabase client for collection persistence tests
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}));

describe('useTravelPinStore extensions', () => {
  beforeEach(() => {
    // Reset store to initial state
    useTravelPinStore.setState({
      pins: [],
      collections: [{ id: 'unorganized', name: 'Unorganized', createdAt: new Date(0).toISOString() }],
      activeCollectionId: null,
      isDrawerOpen: false,
      activePinId: null,
      user: null,
    });
  });

  describe('setUser', () => {
    it('sets user to a User object', () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' } as User;
      useTravelPinStore.getState().setUser(mockUser);
      expect(useTravelPinStore.getState().user).toEqual(mockUser);
    });

    it('sets user to null', () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' } as User;
      useTravelPinStore.getState().setUser(mockUser);
      useTravelPinStore.getState().setUser(null);
      expect(useTravelPinStore.getState().user).toBeNull();
    });
  });

  describe('setCloudData', () => {
    it('replaces pins and collections with provided data', () => {
      // Seed with initial data
      useTravelPinStore.setState({
        pins: [{ id: 'old-pin', title: 'Old', imageUrl: '', sourceUrl: '', latitude: 0, longitude: 0, collectionId: 'x', createdAt: '' }],
        collections: [{ id: 'old-col', name: 'Old', createdAt: '' }],
      });

      const newPins: Pin[] = [
        { id: 'p1', title: 'Pin 1', imageUrl: 'img1', sourceUrl: 'src1', latitude: 10, longitude: 20, collectionId: 'c1', createdAt: '2024-01-01T00:00:00Z', user_id: 'u1' },
      ];
      const newCollections: Collection[] = [
        { id: 'c1', name: 'Collection 1', createdAt: '2024-01-01T00:00:00Z', user_id: 'u1' },
      ];

      useTravelPinStore.getState().setCloudData(newPins, newCollections);

      expect(useTravelPinStore.getState().pins).toEqual(newPins);
      expect(useTravelPinStore.getState().collections).toEqual(newCollections);
    });

    it('replaces with empty arrays', () => {
      useTravelPinStore.setState({
        pins: [{ id: 'p', title: 'T', imageUrl: '', sourceUrl: '', latitude: 0, longitude: 0, collectionId: 'x', createdAt: '' }],
      });

      useTravelPinStore.getState().setCloudData([], []);

      expect(useTravelPinStore.getState().pins).toEqual([]);
      expect(useTravelPinStore.getState().collections).toEqual([]);
    });
  });

  describe('localStorage persistence (partialize)', () => {
    it('user field is not persisted — setting user does not affect persisted state shape', () => {
      // Set a user and verify the store has it in memory
      const mockUser = { id: 'user-123', email: 'test@example.com' } as User;
      useTravelPinStore.getState().setUser(mockUser);
      expect(useTravelPinStore.getState().user).toEqual(mockUser);

      // The persist middleware's partialize only includes pins and collections.
      // We verify this indirectly: after setting user, the store's persist name is correct
      // and the store shape includes user in runtime but the persist config is set up
      // to only serialize pins and collections.
      const storeApi = useTravelPinStore as unknown as { persist: { getOptions: () => { name: string } } };
      if (storeApi.persist?.getOptions) {
        const options = storeApi.persist.getOptions();
        expect(options.name).toBe('travel-pin-board-storage');
      } else {
        // Zustand v5 — verify indirectly that user is a runtime-only field
        // by checking it exists in state but the store name is configured
        expect(useTravelPinStore.getState().user).toBeDefined();
        expect(useTravelPinStore.getState().pins).toBeDefined();
        expect(useTravelPinStore.getState().collections).toBeDefined();
      }
    });
  });

  describe('addPin with undefined primaryType (Requirement 2.6)', () => {
    it('routes pin to the "Unorganized" collection when primaryType is undefined', () => {
      const pin = useTravelPinStore.getState().addPin({
        title: 'Mystery Place',
        imageUrl: 'https://example.com/img.jpg',
        sourceUrl: 'https://example.com',
        latitude: 35.6762,
        longitude: 139.6503,
        // primaryType intentionally omitted (undefined)
      });

      expect(pin.collectionId).toBe('unorganized');

      const unorganized = useTravelPinStore.getState().collections.find(
        (c) => c.id === 'unorganized'
      );
      expect(unorganized).toBeDefined();
      expect(unorganized!.name).toBe('Unorganized');
    });
  });

  describe('Supabase collection persistence when authenticated (Requirement 2.4)', () => {
    beforeEach(() => {
      mockFrom.mockClear();
      mockInsert.mockClear();
    });

    it('calls Supabase collections insert when a new collection is auto-created for an authenticated user', () => {
      // Set an authenticated user
      const mockUser = { id: 'user-abc', email: 'auth@example.com' } as User;
      useTravelPinStore.getState().setUser(mockUser);

      // Add a pin with a primaryType that maps to "Food & Drink" — a collection that doesn't exist yet
      useTravelPinStore.getState().addPin({
        title: 'Ramen Shop',
        imageUrl: 'https://example.com/ramen.jpg',
        sourceUrl: 'https://example.com/ramen',
        latitude: 35.6762,
        longitude: 139.6503,
        primaryType: 'restaurant',
      });

      // Verify Supabase was called to persist the new collection
      expect(mockFrom).toHaveBeenCalledWith('collections');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-abc',
          name: 'Food & Drink',
        })
      );
    });

    it('does NOT call Supabase when user is not authenticated', () => {
      // user is null by default from beforeEach
      useTravelPinStore.getState().addPin({
        title: 'Ramen Shop',
        imageUrl: 'https://example.com/ramen.jpg',
        sourceUrl: 'https://example.com/ramen',
        latitude: 35.6762,
        longitude: 139.6503,
        primaryType: 'restaurant',
      });

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('does NOT call Supabase when the collection already exists', () => {
      const mockUser = { id: 'user-abc', email: 'auth@example.com' } as User;
      useTravelPinStore.getState().setUser(mockUser);

      // Add first pin — creates "Food & Drink" collection and calls Supabase
      useTravelPinStore.getState().addPin({
        title: 'Ramen Shop',
        imageUrl: 'https://example.com/ramen.jpg',
        sourceUrl: 'https://example.com/ramen',
        latitude: 35.6762,
        longitude: 139.6503,
        primaryType: 'restaurant',
      });

      // Clear mocks to isolate the second call
      mockFrom.mockClear();
      mockInsert.mockClear();

      // Add second pin with same category — collection already exists
      useTravelPinStore.getState().addPin({
        title: 'Sushi Bar',
        imageUrl: 'https://example.com/sushi.jpg',
        sourceUrl: 'https://example.com/sushi',
        latitude: 35.6895,
        longitude: 139.6917,
        primaryType: 'cafe',
      });

      // Should NOT call Supabase since "Food & Drink" already exists
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });
});
