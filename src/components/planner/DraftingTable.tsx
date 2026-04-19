'use client';

import { useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { MapPin } from 'lucide-react';
import usePlannerStore from '@/store/usePlannerStore';
import type { Pin, PlannedPin } from '@/types';
import SavedLibrary from './SavedLibrary';
import TripTimeline from './TripTimeline';

type ActiveDragData =
  | { type: 'library-pin'; pin: Pin }
  | { type: 'planned-pin'; dayNumber: number; pinId: string };

export default function DraftingTable() {
  const addPinToDay = usePlannerStore((s) => s.addPinToDay);
  const reorderPinInDay = usePlannerStore((s) => s.reorderPinInDay);
  const movePinBetweenDays = usePlannerStore((s) => s.movePinBetweenDays);
  const dayItems = usePlannerStore((s) => s.dayItems);

  const [activeDrag, setActiveDrag] = useState<ActiveDragData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as ActiveDragData | undefined;
    if (data) setActiveDrag(data);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current as ActiveDragData | undefined;
      if (!activeData) return;

      const overId = String(over.id);
      const overData = over.data.current as Record<string, unknown> | undefined;

      // --- Library pin → Day container ---
      if (activeData.type === 'library-pin') {
        const targetDay = parseDayFromTarget(overId, overData, dayItems);
        if (targetDay !== null) {
          addPinToDay(activeData.pin, targetDay);
        }
        return;
      }

      // --- Planned pin reorder / cross-day move ---
      if (activeData.type === 'planned-pin') {
        const sourceDay = activeData.dayNumber;
        const pinId = activeData.pinId;

        // Determine target day and index
        const targetDay = parseDayFromTarget(overId, overData, dayItems);
        if (targetDay === null) return;

        if (sourceDay === targetDay) {
          // Same-day reorder
          const dayPins = dayItems[sourceDay] ?? [];
          const oldIndex = dayPins.findIndex((p) => p.id === pinId);
          const overItemId = overId;
          const newIndex = dayPins.findIndex(
            (p) => p.itinerary_item_id === overItemId
          );
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            reorderPinInDay(sourceDay, oldIndex, newIndex);
          }
        } else {
          // Cross-day move
          const targetPins = dayItems[targetDay] ?? [];
          const targetIndex = targetPins.findIndex(
            (p) => p.itinerary_item_id === overId
          );
          movePinBetweenDays(
            sourceDay,
            targetDay,
            pinId,
            targetIndex >= 0 ? targetIndex : targetPins.length
          );
        }
      }
    },
    [addPinToDay, reorderPinInDay, movePinBetweenDays, dayItems]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col md:flex-row w-full h-full">
        {/* SavedLibrary: 35% on desktop, top half on mobile */}
        <SavedLibrary className="w-full h-1/2 md:w-[35%] md:h-full overflow-y-auto border-b md:border-b-0 md:border-r border-border" />
        {/* TripTimeline: 65% on desktop, bottom half on mobile */}
        <TripTimeline className="w-full h-1/2 md:w-[65%] md:h-full overflow-y-auto" />
      </div>

      <DragOverlay>
        {activeDrag ? <DragPreview data={activeDrag} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * Parse the target day number from a drop target.
 * Handles both day-container droppables (id = "day-N") and
 * sortable planned-pin items (look up which day they belong to).
 */
function parseDayFromTarget(
  overId: string,
  overData: Record<string, unknown> | undefined,
  dayItems: Record<number, PlannedPin[]>
): number | null {
  // Direct day-container drop
  if (overId.startsWith('day-')) {
    const num = Number(overId.replace('day-', ''));
    return isNaN(num) ? null : num;
  }

  // Over data explicitly says it's a day-container
  if (overData?.type === 'day-container' && typeof overData.dayNumber === 'number') {
    return overData.dayNumber;
  }

  // Dropped over a sortable planned-pin — find which day it belongs to
  for (const [dayStr, pins] of Object.entries(dayItems)) {
    if (pins.some((p) => p.itinerary_item_id === overId)) {
      return Number(dayStr);
    }
  }

  return null;
}

/** Floating preview shown during drag. */
function DragPreview({ data }: { data: ActiveDragData }) {
  if (data.type === 'library-pin') {
    const pin = data.pin;
    return (
      <div className="w-36 rounded-card bg-surface border border-accent shadow-lg overflow-hidden opacity-90">
        <div className="relative aspect-[4/5] bg-neutral-100">
          {pin.imageUrl ? (
            <img src={pin.imageUrl} alt={pin.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-300">
              <MapPin className="w-8 h-8" />
            </div>
          )}
        </div>
        <div className="p-2">
          <p className="text-xs font-medium text-primary truncate">{pin.title}</p>
        </div>
      </div>
    );
  }

  // Planned pin preview — minimal card
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface border border-accent shadow-lg p-2 opacity-90 w-56">
      <div className="w-12 h-12 rounded-md bg-neutral-100 shrink-0" />
      <p className="text-sm font-medium text-primary truncate">Moving pin…</p>
    </div>
  );
}
