'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlannedPin } from '@/types';
import { useDistanceMatrix } from '@/hooks/useDistanceMatrix';
import BridgeElement from './BridgeElement';

export interface DayContainerProps {
  dayNumber: number;
  pins: PlannedPin[];
}

/** Sortable planned-pin card: 64px thumbnail + title. */
function SortablePlannedPinCard({ pin }: { pin: PlannedPin }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: pin.itinerary_item_id,
    data: { type: 'planned-pin', dayNumber: pin.day_number, pinId: pin.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 rounded-lg bg-background border border-border p-2 min-w-0 cursor-grab"
    >
      <div className="w-16 h-16 rounded-md bg-neutral-100 overflow-hidden shrink-0">
        {pin.imageUrl ? (
          <img
            src={pin.imageUrl}
            alt={pin.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300 text-xs">
            No img
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-primary truncate">{pin.title}</p>
    </div>
  );
}

/** Day container: droppable zone wrapping a SortableContext for planned pins. */
export default function DayContainer({ dayNumber, pins }: DayContainerProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayNumber}`,
    data: { type: 'day-container', dayNumber },
  });

  const { segments, isLoading } = useDistanceMatrix(pins, 'driving');
  const sortableIds = pins.map((p) => p.itinerary_item_id);

  return (
    <div
      ref={setNodeRef}
      className={`rounded-card bg-surface border p-3 transition-colors ${
        isOver ? 'border-accent bg-accent/5' : 'border-border'
      }`}
    >
      <h3 className="text-sm font-semibold text-primary mb-2">Day {dayNumber}</h3>

      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {pins.length === 0 ? (
          <p className="text-xs text-neutral-400 py-4 text-center">
            Drag pins here to plan your day
          </p>
        ) : (
          <div className="flex flex-col gap-0">
            <AnimatePresence initial={false}>
              {pins.map((pin, index) => (
                <motion.div
                  key={pin.itinerary_item_id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, layout: { duration: 0.25 } }}
                >
                  <SortablePlannedPinCard pin={pin} />
                  {index < pins.length - 1 && (
                    <BridgeElement
                      distance={segments[index]?.distance ?? ''}
                      duration={segments[index]?.duration ?? ''}
                      mode={segments[index]?.mode ?? 'driving'}
                      isLoading={isLoading}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </SortableContext>
    </div>
  );
}
