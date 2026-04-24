import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Pin, Itinerary, PlannedPin, SaveDayItem } from '@/types';
import { createClient } from '@/utils/supabase/client';
import useToastStore from '@/store/useToastStore';
import {
  createItineraryAction,
  deleteItineraryAction,
  renameItineraryAction,
  saveItineraryAction,
  cloneItineraryAction,
} from '@/actions/itineraryActions';

export interface PlannerStore {
  // State
  activeItinerary: Itinerary | null;
  dayItems: Record<number, PlannedPin[]>;
  hasUnsavedChanges: boolean;
  isLoadingItinerary: boolean;
  isSaving: boolean;
  itineraries: Itinerary[];

  // Local mutation actions
  addPinToDay: (pin: Pin, dayNumber: number) => void;
  reorderPinInDay: (dayNumber: number, oldIndex: number, newIndex: number) => void;
  movePinBetweenDays: (sourceDay: number, targetDay: number, pinId: string, targetIndex: number) => void;
  removePinFromDay: (dayNumber: number, pinId: string) => void;
  addDay: () => void;

  // Supabase CRUD actions
  createItinerary: (name: string, tripDate?: string) => Promise<void>;
  fetchItineraries: () => Promise<void>;
  loadItinerary: (itineraryId: string) => Promise<void>;
  saveItinerary: () => Promise<void>;
  deleteItinerary: (itineraryId: string) => Promise<void>;
  renameItinerary: (itineraryId: string, newName: string) => Promise<void>;
  cloneItinerary: (sourceItineraryId: string) => Promise<string | null>;
}

/** Recalculate sort_order for all pins in an array (index-based: 0, 1, 2, ...). */
function recalcSortOrder(pins: PlannedPin[]): PlannedPin[] {
  return pins.map((pin, index) => ({ ...pin, sort_order: index }));
}

const usePlannerStore = create<PlannerStore>()((set) => ({
  activeItinerary: null,
  dayItems: {},
  hasUnsavedChanges: false,
  isLoadingItinerary: false,
  isSaving: false,
  itineraries: [],

  addPinToDay: (pin, dayNumber) => {
    set((state) => {
      const dayPins = state.dayItems[dayNumber] ?? [];
      const plannedPin: PlannedPin = {
        ...pin,
        day_number: dayNumber,
        sort_order: dayPins.length,
        itinerary_item_id: uuidv4(),
      };
      return {
        dayItems: {
          ...state.dayItems,
          [dayNumber]: [...dayPins, plannedPin],
        },
        hasUnsavedChanges: true,
      };
    });
  },

  reorderPinInDay: (dayNumber, oldIndex, newIndex) => {
    // Capture snapshot before mutation for rollback
    const snapshot = usePlannerStore.getState().dayItems;

    set((state) => {
      const dayPins = [...(state.dayItems[dayNumber] ?? [])];
      if (oldIndex < 0 || oldIndex >= dayPins.length || newIndex < 0 || newIndex >= dayPins.length) {
        return state;
      }
      const [moved] = dayPins.splice(oldIndex, 1);
      dayPins.splice(newIndex, 0, moved);
      return {
        dayItems: {
          ...state.dayItems,
          [dayNumber]: recalcSortOrder(dayPins),
        },
        hasUnsavedChanges: true,
      };
    });

    // Fire background save
    set({ isSaving: true });
    usePlannerStore.getState().saveItinerary()
      .then(() => {
        set({ isSaving: false });
      })
      .catch(() => {
        set({ dayItems: snapshot, hasUnsavedChanges: true, isSaving: false });
        useToastStore.getState().addToast("Sync failed. Reverting changes.", "error");
      });
  },

  movePinBetweenDays: (sourceDay, targetDay, pinId, targetIndex) => {
    // Capture snapshot before mutation for rollback
    const snapshot = usePlannerStore.getState().dayItems;

    set((state) => {
      const sourcePins = [...(state.dayItems[sourceDay] ?? [])];
      const targetPins = [...(state.dayItems[targetDay] ?? [])];

      const pinIndex = sourcePins.findIndex((p) => p.id === pinId);
      if (pinIndex === -1) return state;

      const [movedPin] = sourcePins.splice(pinIndex, 1);
      const updatedPin: PlannedPin = { ...movedPin, day_number: targetDay };
      targetPins.splice(targetIndex, 0, updatedPin);

      return {
        dayItems: {
          ...state.dayItems,
          [sourceDay]: recalcSortOrder(sourcePins),
          [targetDay]: recalcSortOrder(targetPins),
        },
        hasUnsavedChanges: true,
      };
    });

    // Fire background save
    set({ isSaving: true });
    usePlannerStore.getState().saveItinerary()
      .then(() => {
        set({ isSaving: false });
      })
      .catch(() => {
        set({ dayItems: snapshot, hasUnsavedChanges: true, isSaving: false });
        useToastStore.getState().addToast("Sync failed. Reverting changes.", "error");
      });
  },

  removePinFromDay: (dayNumber, pinId) => {
    set((state) => {
      const dayPins = (state.dayItems[dayNumber] ?? []).filter((p) => p.id !== pinId);
      return {
        dayItems: {
          ...state.dayItems,
          [dayNumber]: recalcSortOrder(dayPins),
        },
      };
    });
  },

  addDay: () => {
    set((state) => {
      const keys = Object.keys(state.dayItems).map(Number);
      const maxDay = keys.length > 0 ? Math.max(...keys) : 0;
      return {
        dayItems: {
          ...state.dayItems,
          [maxDay + 1]: [],
        },
      };
    });
  },

  createItinerary: async (name, tripDate) => {
    const result = await createItineraryAction(name, tripDate);
    if (!result.success) {
      useToastStore.getState().addToast(result.error, 'error');
      return;
    }
    set((state) => ({
      activeItinerary: result.data,
      itineraries: [...state.itineraries, result.data],
      dayItems: { 1: [] },
      hasUnsavedChanges: false,
    }));
  },

  fetchItineraries: async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('itineraries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PlannerStore] fetchItineraries failed:', error.message);
      return;
    }

    const itineraries: Itinerary[] = (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      tripDate: row.trip_date,
      createdAt: row.created_at,
    }));

    set({ itineraries });
  },

  loadItinerary: async (itineraryId) => {
    set({ isLoadingItinerary: true });

    try {
      const supabase = createClient();

      // Fetch the itinerary
      const { data: itineraryRow, error: itinError } = await supabase
        .from('itineraries')
        .select('*')
        .eq('id', itineraryId)
        .single();

      if (itinError || !itineraryRow) {
        console.error('[PlannerStore] loadItinerary failed:', itinError?.message);
        set({ isLoadingItinerary: false });
        return;
      }

      // Fetch items joined with pin data
      const { data: itemRows, error: itemsError } = await supabase
        .from('itinerary_items')
        .select('*, pins(*)')
        .eq('itinerary_id', itineraryId)
        .order('day_number', { ascending: true })
        .order('sort_order', { ascending: true });

      if (itemsError) {
        console.error('[PlannerStore] loadItinerary items failed:', itemsError.message);
        set({ isLoadingItinerary: false });
        return;
      }

      const itinerary: Itinerary = {
        id: itineraryRow.id,
        userId: itineraryRow.user_id,
        name: itineraryRow.name,
        tripDate: itineraryRow.trip_date,
        createdAt: itineraryRow.created_at,
      };

      // Group items by day_number, hydrate as PlannedPins
      const dayItems: Record<number, PlannedPin[]> = {};
      for (const item of itemRows ?? []) {
        const pin = item.pins as Record<string, unknown>;
        if (!pin) continue;

        const plannedPin: PlannedPin = {
          id: pin.id as string,
          title: pin.title as string,
          description: (pin.description as string) ?? undefined,
          imageUrl: pin.image_url as string,
          sourceUrl: pin.source_url as string,
          latitude: pin.latitude as number,
          longitude: pin.longitude as number,
          collectionId: pin.collection_id as string,
          createdAt: pin.created_at as string,
          placeId: (pin.place_id as string) ?? undefined,
          primaryType: (pin.primary_type as string) ?? undefined,
          rating: (pin.rating as number) ?? undefined,
          address: (pin.address as string) ?? undefined,
          user_id: (pin.user_id as string) ?? undefined,
          day_number: item.day_number,
          sort_order: item.sort_order,
          itinerary_item_id: item.id,
        };

        const day = item.day_number as number;
        if (!dayItems[day]) dayItems[day] = [];
        dayItems[day].push(plannedPin);
      }

      // Ensure at least day 1 exists
      if (Object.keys(dayItems).length === 0) {
        dayItems[1] = [];
      }

      set({
        activeItinerary: itinerary,
        dayItems,
        hasUnsavedChanges: false,
        isLoadingItinerary: false,
      });
    } catch (error) {
      console.error('[PlannerStore] loadItinerary unexpected error:', error);
      set({ isLoadingItinerary: false });
    }
  },

  saveItinerary: async () => {
    const { activeItinerary, dayItems } = usePlannerStore.getState();
    if (!activeItinerary) {
      throw new Error('No active itinerary to save');
    }

    // Serialize dayItems into flat SaveDayItem array
    const items: SaveDayItem[] = [];
    for (const [dayStr, pins] of Object.entries(dayItems)) {
      const dayNumber = Number(dayStr);
      for (const pin of pins) {
        items.push({
          pinId: pin.id,
          dayNumber,
          sortOrder: pin.sort_order,
        });
      }
    }

    const result = await saveItineraryAction(activeItinerary.id, items);
    if (!result.success) {
      useToastStore.getState().addToast(result.error, 'error');
      throw new Error(result.error);
    }

    set({ hasUnsavedChanges: false });
  },

  deleteItinerary: async (itineraryId) => {
    const result = await deleteItineraryAction(itineraryId);
    if (!result.success) {
      useToastStore.getState().addToast(result.error, 'error');
      return;
    }

    set((state) => ({
      itineraries: state.itineraries.filter((it) => it.id !== itineraryId),
      activeItinerary: state.activeItinerary?.id === itineraryId ? null : state.activeItinerary,
      dayItems: state.activeItinerary?.id === itineraryId ? {} : state.dayItems,
      hasUnsavedChanges: state.activeItinerary?.id === itineraryId ? false : state.hasUnsavedChanges,
    }));
  },

  renameItinerary: async (itineraryId, newName) => {
    const result = await renameItineraryAction(itineraryId, newName);
    if (!result.success) {
      useToastStore.getState().addToast(result.error, 'error');
      return;
    }

    set((state) => ({
      itineraries: state.itineraries.map((it) =>
        it.id === itineraryId ? { ...it, name: newName } : it
      ),
      activeItinerary:
        state.activeItinerary?.id === itineraryId
          ? { ...state.activeItinerary, name: newName }
          : state.activeItinerary,
    }));
  },

  cloneItinerary: async (sourceItineraryId) => {
    const result = await cloneItineraryAction(sourceItineraryId);
    if (!result.success) {
      useToastStore.getState().addToast(result.error, 'error');
      return null;
    }

    // Load the cloned itinerary into the store
    await usePlannerStore.getState().loadItinerary(result.data);

    return result.data;
  },
}));

export default usePlannerStore;
