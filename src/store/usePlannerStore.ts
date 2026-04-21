import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Pin, Itinerary, PlannedPin } from '@/types';
import { createClient } from '@/utils/supabase/client';

export interface PlannerStore {
  // State
  activeItinerary: Itinerary | null;
  dayItems: Record<number, PlannedPin[]>;
  hasUnsavedChanges: boolean;
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
  },

  movePinBetweenDays: (sourceDay, targetDay, pinId, targetIndex) => {
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
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[PlannerStore] No authenticated user');
      return;
    }

    const { data, error } = await supabase
      .from('itineraries')
      .insert({
        user_id: user.id,
        name,
        trip_date: tripDate ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('[PlannerStore] createItinerary failed:', error.message);
      return;
    }

    const itinerary: Itinerary = {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      tripDate: data.trip_date,
      createdAt: data.created_at,
    };

    set((state) => ({
      activeItinerary: itinerary,
      itineraries: [...state.itineraries, itinerary],
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
    const supabase = createClient();

    // Fetch the itinerary
    const { data: itineraryRow, error: itinError } = await supabase
      .from('itineraries')
      .select('*')
      .eq('id', itineraryId)
      .single();

    if (itinError || !itineraryRow) {
      console.error('[PlannerStore] loadItinerary failed:', itinError?.message);
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
    });
  },

  saveItinerary: async () => {
    const { activeItinerary, dayItems } = usePlannerStore.getState();
    if (!activeItinerary) {
      console.error('[PlannerStore] No active itinerary to save');
      return;
    }

    const supabase = createClient();

    // Delete existing items for this itinerary, then insert fresh
    const { error: deleteError } = await supabase
      .from('itinerary_items')
      .delete()
      .eq('itinerary_id', activeItinerary.id);

    if (deleteError) {
      console.error('[PlannerStore] saveItinerary delete failed:', deleteError.message);
      return;
    }

    // Collect all items across all days
    const rows: { itinerary_id: string; pin_id: string; day_number: number; sort_order: number }[] = [];
    for (const [dayStr, pins] of Object.entries(dayItems)) {
      const dayNumber = Number(dayStr);
      for (const pin of pins) {
        rows.push({
          itinerary_id: activeItinerary.id,
          pin_id: pin.id,
          day_number: dayNumber,
          sort_order: pin.sort_order,
        });
      }
    }

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from('itinerary_items')
        .insert(rows);

      if (insertError) {
        console.error('[PlannerStore] saveItinerary insert failed:', insertError.message);
        return;
      }
    }

    set({ hasUnsavedChanges: false });
  },

  deleteItinerary: async (itineraryId) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('itineraries')
      .delete()
      .eq('id', itineraryId);

    if (error) {
      console.error('[PlannerStore] deleteItinerary failed:', error.message);
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
    const supabase = createClient();
    const { error } = await supabase
      .from('itineraries')
      .update({ name: newName })
      .eq('id', itineraryId);

    if (error) {
      console.error('[PlannerStore] renameItinerary failed:', error.message);
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
    const supabase = createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[PlannerStore] cloneItinerary: No authenticated user');
      return null;
    }

    // Fetch source itinerary (RLS allows SELECT on public itineraries)
    const { data: sourceItinerary, error: itinError } = await supabase
      .from('itineraries')
      .select('*')
      .eq('id', sourceItineraryId)
      .single();

    if (itinError || !sourceItinerary) {
      console.error('[PlannerStore] cloneItinerary: Failed to fetch source itinerary:', itinError?.message);
      return null;
    }

    // Fetch source itinerary items with pins
    const { data: sourceItems, error: itemsError } = await supabase
      .from('itinerary_items')
      .select('*, pins(*)')
      .eq('itinerary_id', sourceItineraryId)
      .order('day_number', { ascending: true })
      .order('sort_order', { ascending: true });

    if (itemsError) {
      console.error('[PlannerStore] cloneItinerary: Failed to fetch source items:', itemsError.message);
      return null;
    }

    // Create new itinerary owned by the current user with the same name
    const { data: newItinerary, error: createError } = await supabase
      .from('itineraries')
      .insert({
        user_id: user.id,
        name: sourceItinerary.name,
        trip_date: sourceItinerary.trip_date ?? null,
      })
      .select()
      .single();

    if (createError || !newItinerary) {
      console.error('[PlannerStore] cloneItinerary: Failed to create new itinerary:', createError?.message);
      return null;
    }

    // Batch-insert new itinerary_items preserving day_number and sort_order
    const items = sourceItems ?? [];
    if (items.length > 0) {
      const rows = items.map((item) => ({
        itinerary_id: newItinerary.id,
        pin_id: item.pin_id,
        day_number: item.day_number,
        sort_order: item.sort_order,
      }));

      const { error: insertError } = await supabase
        .from('itinerary_items')
        .insert(rows);

      if (insertError) {
        console.error('[PlannerStore] cloneItinerary: Failed to insert items:', insertError.message);
        return newItinerary.id;
      }
    }

    // Load the cloned itinerary into the store
    await usePlannerStore.getState().loadItinerary(newItinerary.id);

    return newItinerary.id;
  },
}));

export default usePlannerStore;
