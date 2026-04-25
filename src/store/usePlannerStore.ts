import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Pin, Itinerary, PlannedPin } from '@/types';

export interface PlannerStore {
  // State
  activeItinerary: Itinerary | null;
  dayItems: Record<number, PlannedPin[]>;
  hasUnsavedChanges: boolean;
  isLoadingItinerary: boolean;

  // Hydration action
  setItineraryData: (itinerary: Itinerary, dayItems: Record<number, PlannedPin[]>) => void;

  // Local mutation actions
  addPinToDay: (pin: Pin, dayNumber: number) => void;
  reorderPinInDay: (dayNumber: number, oldIndex: number, newIndex: number) => void;
  movePinBetweenDays: (sourceDay: number, targetDay: number, pinId: string, targetIndex: number) => void;
  removePinFromDay: (dayNumber: number, pinId: string) => void;
  addDay: () => void;
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

  setItineraryData: (itinerary, dayItems) => {
    set({ activeItinerary: itinerary, dayItems, hasUnsavedChanges: false });
  },

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
}));

export default usePlannerStore;
