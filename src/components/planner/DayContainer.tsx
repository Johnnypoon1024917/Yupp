'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Map, MapPin } from 'lucide-react';
import type { PlannedPin } from '@/types';
import { getGoogleMapsDirUrl } from '@/utils/mapExport';
import { useDistanceMatrix } from '@/hooks/useDistanceMatrix';
import BridgeElement from './BridgeElement';
import PinCardSkeleton from './PinCardSkeleton';

export interface DayContainerProps {
  dayNumber: number;
  pins: PlannedPin[];
  isLoading?: boolean;
}

/** TimelineCard: horizontal card — Image [64px x 64px rounded-lg] | Title | Drag Handle */
function TimelineCard({ pin }: { pin: PlannedPin }) {
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
      className="flex items-center gap-3 rounded-lg bg-white border border-gray-200 p-2 min-w-0 group"
    >
      <div className="w-16 h-16 rounded-lg bg-neutral-100 overflow-hidden shrink-0">
        {pin.imageUrl ? (
          <img
            src={pin.imageUrl}
            alt={pin.title}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300">
            <MapPin className="w-5 h-5" />
          </div>
        )}
      </div>
      <p className="flex-1 text-[13px] font-bold tracking-tight text-[#111111] truncate">
        {pin.title}
      </p>
      <div
        {...listeners}
        className="shrink-0 p-1 cursor-grab active:cursor-grabbing text-neutral-300 group-hover:text-neutral-500 transition-colors"
        aria-label="Drag handle"
      >
        <GripVertical className="w-4 h-4" />
      </div>
    </div>
  );
}

/** Day container: droppable zone wrapping a SortableContext for planned pins. */
export default function DayContainer({ dayNumber, pins, isLoading }: DayContainerProps) {
  const { segments, isLoading: isDistanceLoading } = useDistanceMatrix(pins, 'driving');

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayNumber}`,
    data: { type: 'day-container', dayNumber },
  });

  const sortableIds = pins.map((p) => p.itinerary_item_id);

  return (
    <div
      ref={isLoading ? undefined : setNodeRef}
      data-droppable-day={dayNumber}
      className={`rounded-card border p-4 transition-colors ${
        isOver && !isLoading ? 'border-accent bg-accent/5' : 'border-gray-200 bg-white'
      }`}
    >
      {/* Day header with optional Map Route link */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[24px] font-extrabold tracking-[-0.5px] text-[#111111] m-0">
          Day {dayNumber}
        </h3>
        {pins.length > 0 && (
          <a
            href={getGoogleMapsDirUrl(pins) || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[13px] font-bold text-accent bg-accent/10 px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors"
          >
            <Map size={14} />
            Map Route
          </a>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <PinCardSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      ) : (
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {pins.length === 0 ? (
            <p className="text-[13px] text-neutral-400 py-6 text-center border border-dashed border-gray-200 rounded-lg">
              Drag pins here to plan your day
            </p>
          ) : (
            <div className="flex flex-col gap-0">
              <AnimatePresence initial={false}>
                {pins.map((pin, index) => (
                  <motion.div
                    key={pin.itinerary_item_id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.2, layout: { duration: 0.25 } }}
                  >
                    <TimelineCard pin={pin} />
                    {index < pins.length - 1 && (
                      <BridgeElement distance={segments[index]} isLoading={isDistanceLoading} />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </SortableContext>
      )}
    </div>
  );
}
