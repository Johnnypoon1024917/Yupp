import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Pin, Collection } from '@/types';

export interface TravelPinStore {
  // State
  pins: Pin[];
  collections: Collection[];
  activeCollectionId: string | null;
  isDrawerOpen: boolean;
  activePinId: string | null;

  // Actions
  addPin: (pin: Omit<Pin, 'id' | 'createdAt' | 'collectionId'>) => Pin;
  removePin: (pinId: string) => void;
  movePin: (pinId: string, collectionId: string) => void;
  addCollection: (name: string) => Collection;
  removeCollection: (collectionId: string) => void;
  setActiveCollection: (collectionId: string | null) => void;
  toggleDrawer: () => void;
  setActivePinId: (pinId: string | null) => void;
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

      addPin: (pinData) => {
        const newPin: Pin = {
          ...pinData,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          collectionId: 'unorganized',
        };
        set((state) => ({ pins: [...state.pins, newPin] }));
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
