import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Pin, Collection } from '@/types';
import type { User } from '@supabase/supabase-js';
import { getCollectionForType } from '@/utils/categories';
import {
  updatePinAction,
  renameCollectionAction,
  deleteCollectionAction,
  persistCollectionAction,
} from '@/actions/pinActions';

export interface TravelPinStore {
  // State
  pins: Pin[];
  collections: Collection[];
  activeCollectionId: string | null;
  isDrawerOpen: boolean;
  activePinId: string | null;
  user: User | null;

  // Actions
  addPin: (pin: Omit<Pin, 'id' | 'createdAt' | 'collectionId'>) => Pin;
  removePin: (pinId: string) => void;
  movePin: (pinId: string, collectionId: string) => void;
  addCollection: (name: string) => Collection;
  removeCollection: (collectionId: string) => void;
  updatePin: (id: string, updates: Partial<Pin>) => void;
  renameCollection: (id: string, newName: string) => void;
  setActiveCollection: (collectionId: string | null) => void;
  toggleDrawer: () => void;
  setActivePinId: (pinId: string | null) => void;
  setUser: (user: User | null) => void;
  setCloudData: (pins: Pin[], collections: Collection[]) => void;
}

const DEFAULT_COLLECTION: Collection = {
  id: 'unorganized',
  name: 'Unorganized',
  createdAt: new Date(0).toISOString(),
};

const useTravelPinStore = create<TravelPinStore>()(
  persist(
    (set) => ({
      pins: [],
      collections: [DEFAULT_COLLECTION],
      activeCollectionId: null,
      isDrawerOpen: false,
      activePinId: null,
      user: null,

      addPin: (pinData) => {
        const collectionName = getCollectionForType(pinData.primaryType);

        // We need current state to find/create the collection
        const currentState = useTravelPinStore.getState();
        let targetCollection = currentState.collections.find(
          (c) => c.name === collectionName
        );

        let newCollectionCreated = false;
        if (!targetCollection) {
          targetCollection = {
            id: uuidv4(),
            name: collectionName,
            createdAt: new Date().toISOString(),
          };
          newCollectionCreated = true;
        }

        const newPin: Pin = {
          ...pinData,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          collectionId: targetCollection.id,
        };

        set((state) => ({
          pins: [...state.pins, newPin],
          ...(newCollectionCreated
            ? { collections: [...state.collections, targetCollection!] }
            : {}),
        }));

        // Fire-and-forget server action for auto-created collections
        if (newCollectionCreated && currentState.user) {
          persistCollectionAction(targetCollection.id, targetCollection.name)
            .then((result) => {
              if (!result.success) {
                console.error('[addPin] Failed to persist auto-created collection:', result.error);
              }
            });
        }

        return newPin;
      },

      removePin: (pinId) => {
        set((state) => ({
          pins: state.pins.filter((p) => p.id !== pinId),
        }));
      },

      movePin: (pinId, collectionId) => {
        set((state) => ({
          pins: state.pins.map((p) =>
            p.id === pinId ? { ...p, collectionId } : p
          ),
        }));
      },

      addCollection: (name) => {
        const newCollection: Collection = {
          id: uuidv4(),
          name,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          collections: [...state.collections, newCollection],
        }));
        return newCollection;
      },

      removeCollection: (collectionId) => {
        if (collectionId === 'unorganized') return;
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== collectionId),
          pins: state.pins.map((p) =>
            p.collectionId === collectionId
              ? { ...p, collectionId: 'unorganized' }
              : p
          ),
        }));

        // Fire-and-forget server action for authenticated users
        const currentState = useTravelPinStore.getState();
        if (currentState.user) {
          deleteCollectionAction(collectionId)
            .then((result) => {
              if (!result.success) {
                console.error('[removeCollection] Failed to delete collection:', result.error);
              }
            });
        }
      },

      updatePin: (id, updates) => {
        const currentState = useTravelPinStore.getState();
        const pinExists = currentState.pins.some((p) => p.id === id);
        if (!pinExists) return;

        set((state) => ({
          pins: state.pins.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));

        // Fire-and-forget server action for authenticated users
        if (currentState.user) {
          updatePinAction(id, updates)
            .then((result) => {
              if (!result.success) {
                console.error('[updatePin] Failed to persist pin update:', result.error);
              }
            });
        }
      },

      renameCollection: (id, newName) => {
        if (id === 'unorganized') return;

        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === id ? { ...c, name: newName } : c
          ),
        }));

        // Fire-and-forget server action for authenticated users
        const currentState = useTravelPinStore.getState();
        if (currentState.user) {
          renameCollectionAction(id, newName)
            .then((result) => {
              if (!result.success) {
                console.error('[renameCollection] Failed to persist collection rename:', result.error);
              }
            });
        }
      },

      setActiveCollection: (collectionId) => {
        set({ activeCollectionId: collectionId });
      },

      toggleDrawer: () => {
        set((state) => ({ isDrawerOpen: !state.isDrawerOpen }));
      },

      setActivePinId: (pinId) => {
        set({ activePinId: pinId });
      },

      setUser: (user) => {
        set({ user });
      },

      setCloudData: (pins, collections) => {
        set({ pins, collections });
      },
    }),
    {
      name: 'travel-pin-board-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pins: state.pins,
        collections: state.collections,
      }),
    }
  )
);

export default useTravelPinStore;
