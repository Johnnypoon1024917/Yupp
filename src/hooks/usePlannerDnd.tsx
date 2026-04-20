'use client';

import { useCallback, useState } from 'react';
import {
  DragStartEvent,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { MapPin } from 'lucide-react';
import usePlannerStore from '@/store/usePlannerStore';
import type { Pin, PlannedPin } from '@/types';

export type ActiveDragData =
  | { type: 'library-pin'; pin: Pin }
  | { type: 'planned-pin'; dayNumber: number; pinId: string };

/**
 * Parse the target day number from a drop target.
 */
export function parseDayFromTarget(
  overId: string,
  overData: Record<string, unknown> | undefined,
  dayItems: Record<number, PlannedPin[]>
): number | null {
  if (overId.startsWith('day-')) {
    const num = Number(overId.replace('day-', ''));
    return isNaN(num) ? null : num;
  }

  if (overData?.type === 'day-container' && typeof overData.dayNumber === 'number') {
    return overData.dayNumber;
  }

  for (const [dayStr, pins] of Object.entries(dayItems)) {
    if (pins.some((p) => p.itinerary_item_id === overId)) {
      return Number(dayStr);
    }
  }

  return null;
}

export interface UsePlannerDndOptions {
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function usePlannerDnd(options?: UsePlannerDndOptions) {
  const addPinToDay = usePlannerStore((s) => s.addPinToDay);
  const reorderPinInDay = usePlannerStore((s) => s.reorderPinInDay);
  const movePinBetweenDays = usePlannerStore((s) => s.movePinBetweenDays);
  const dayItems = usePlannerStore((s) => s.dayItems);

  const [activeDrag, setActiveDrag] = useState<ActiveDragData | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as ActiveDragData | undefined;
    if (data) setActiveDrag(data);
    options?.onDragStart?.();
  }, [options]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      options?.onDragEnd?.();
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

        const targetDay = parseDayFromTarget(overId, overData, dayItems);
        if (targetDay === null) return;

        if (sourceDay === targetDay) {
          const dayPins = dayItems[sourceDay] ?? [];
          const oldIndex = dayPins.findIndex((p) => p.id === pinId);
          const newIndex = dayPins.findIndex(
            (p) => p.itinerary_item_id === overId
          );
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            reorderPinInDay(sourceDay, oldIndex, newIndex);
          }
        } else {
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
    [addPinToDay, reorderPinInDay, movePinBetweenDays, dayItems, options]
  );

  return { sensors, activeDrag, handleDragStart, handleDragEnd, DragPreview };
}

/** Floating preview shown during drag. */
function DragPreview({ data }: { data: ActiveDragData }) {
  if (data.type === 'library-pin') {
    const pin = data.pin;
    return (
      <div className="w-36 rounded-card bg-white border border-gray-200 shadow-lg overflow-hidden opacity-90 pointer-events-none">
        <div className="relative aspect-[4/5] bg-neutral-100">
          {pin.imageUrl ? (
            <img src={pin.imageUrl} alt={pin.title} className="w-full h-full object-cover" draggable={false} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-300">
              <MapPin className="w-8 h-8" />
            </div>
          )}
        </div>
        <div className="p-2">
          <p className="text-[13px] font-bold tracking-tight text-[#111111] truncate">{pin.title}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg bg-white border border-gray-200 shadow-lg p-2 opacity-90 w-56 pointer-events-none">
      <div className="w-16 h-16 rounded-lg bg-neutral-100 shrink-0" />
      <p className="text-[13px] font-bold tracking-tight text-[#111111] truncate">Moving pin…</p>
    </div>
  );
}
