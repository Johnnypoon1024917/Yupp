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
import { useState, useRef, useCallback, useMemo } from 'react';
import { DURATION_FAST, DURATION_BASE } from '@/utils/motion';
import type { PlannedPin } from '@/types';
import { getGoogleMapsDirUrl } from '@/utils/mapExport';
import { useDistanceMatrix } from '@/hooks/useDistanceMatrix';
import { useWeather } from '@/hooks/useWeather';
import { getDominantCity } from '@/utils/address';
import { haptics } from '@/utils/haptics';
import BridgeElement from './BridgeElement';
import PinCardSkeleton from './PinCardSkeleton';

export interface DayContainerProps {
  dayNumber: number;
  pins: PlannedPin[];
  isLoading?: boolean;
  tripDate?: string | null;
}

/** Format a date string for the day header, e.g. "Mon, Jun 16" */
function formatDayDate(tripDate: string, dayNumber: number): string {
  const base = new Date(tripDate + 'T00:00:00');
  if (isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + dayNumber - 1);
  return base.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Compute the target date string (YYYY-MM-DD) for weather lookup */
function getTargetDate(tripDate: string, dayNumber: number): string {
  const base = new Date(tripDate + 'T00:00:00');
  if (isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + dayNumber - 1);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Sum distance strings like "5.2 km" or "3.1 mi" into a total */
function sumDistances(segments: { distance: string }[]): string {
  if (segments.length === 0) return '';
  let total = 0;
  let unit = 'km';
  for (const seg of segments) {
    const match = seg.distance.match(/([\d.]+)\s*(km|mi|m)/i);
    if (match) {
      total += parseFloat(match[1]);
      unit = match[2];
    }
  }
  if (total === 0) return '';
  return `${total.toFixed(1)} ${unit}`;
}

/** TimelineCard: horizontal card — Image [64px x 64px rounded-card] | Title | Drag Handle */
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
      className="flex items-center gap-3 rounded-card bg-surface border border-border p-2 min-w-0 group"
    >
      <div className="w-16 h-16 rounded-card bg-surface-sunken overflow-hidden shrink-0">
        {pin.imageUrl ? (
          <img
            src={pin.imageUrl}
            alt={pin.title}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-3">
            <MapPin className="w-5 h-5" aria-hidden="true" />
          </div>
        )}
      </div>
      <p className="flex-1 text-caption font-bold text-ink-1 truncate">
        {pin.title}
      </p>
      <div
        {...listeners}
        className="shrink-0 p-1 cursor-grab active:cursor-grabbing text-ink-3 group-hover:text-ink-2 transition-colors"
        aria-label="Drag handle"
      >
        <GripVertical className="w-4 h-4" aria-hidden="true" />
      </div>
    </div>
  );
}

/** Day container: droppable zone wrapping a SortableContext for planned pins. */
export default function DayContainer({ dayNumber, pins, isLoading, tripDate }: DayContainerProps) {
  const { segments, isLoading: isDistanceLoading } = useDistanceMatrix(pins, 'driving');

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayNumber}`,
    data: { type: 'day-container', dayNumber },
  });

  const sortableIds = pins.map((p) => p.itinerary_item_id);

  // Dominant city from pin addresses
  const dominantCity = useMemo(() => getDominantCity(pins), [pins]);

  // Formatted date
  const formattedDate = tripDate ? formatDayDate(tripDate, dayNumber) : '';
  const targetDate = tripDate ? getTargetDate(tripDate, dayNumber) : null;

  // Weather: use first pin's lat/lng as representative location
  const representativePin = pins.length > 0 ? pins[0] : null;
  const { data: weather } = useWeather(
    representativePin?.latitude ?? null,
    representativePin?.longitude ?? null,
    targetDate,
  );

  // Total distance
  const totalDistance = useMemo(() => sumDistances(segments), [segments]);

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartRename = useCallback(() => {
    setCustomLabel(`Day ${dayNumber}`);
    setIsRenaming(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [dayNumber]);

  const handleSaveRename = useCallback(() => {
    setIsRenaming(false);
    haptics.success();
  }, []);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveRename();
      } else if (e.key === 'Escape') {
        setIsRenaming(false);
      }
    },
    [handleSaveRename],
  );

  const dayTitle = customLabel && !isRenaming ? customLabel : `Day ${dayNumber}`;

  return (
    <div
      ref={isLoading ? undefined : setNodeRef}
      data-droppable-day={dayNumber}
      className={`rounded-card border transition-colors ${
        isOver && !isLoading ? 'border-accent bg-accent/5' : 'border-border bg-surface'
      }`}
    >
      {/* Sticky metadata header */}
      <div className="sticky top-0 z-10 bg-surface rounded-t-card border-b border-border px-4 py-3">
        {/* Row 1: Day title + date | City */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isRenaming ? (
              <input
                ref={inputRef}
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                onBlur={handleSaveRename}
                onKeyDown={handleRenameKeyDown}
                className="text-title text-ink-1 bg-transparent border-b-2 border-brand outline-none min-w-0 max-w-[160px]"
                aria-label={`Rename day ${dayNumber}`}
              />
            ) : (
              <button
                onClick={handleStartRename}
                className="text-title text-ink-1 hover:text-brand transition-colors truncate text-left"
                aria-label={`Rename day ${dayNumber}`}
              >
                {dayTitle}
              </button>
            )}
            {formattedDate && (
              <span className="text-caption text-ink-3 shrink-0">· {formattedDate}</span>
            )}
          </div>
          {dominantCity && (
            <span className="text-caption text-ink-2 truncate max-w-[120px]">{dominantCity}</span>
          )}
        </div>

        {/* Row 2: Stop count + distance | Weather chip */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-2 text-micro text-ink-3">
            <span>{pins.length} {pins.length === 1 ? 'stop' : 'stops'}</span>
            {totalDistance && (
              <>
                <span>·</span>
                <span>{totalDistance}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {weather && (
              <span className="inline-flex items-center gap-1 text-micro text-ink-2 bg-surface-sunken px-2 py-0.5 rounded-chip">
                <span>{weather.icon}</span>
                <span>{Math.round(weather.tempHigh)}°/{Math.round(weather.tempLow)}°</span>
              </span>
            )}
            {pins.length > 0 && (
              <a
                href={getGoogleMapsDirUrl(pins) || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-micro text-accent bg-accent/10 px-2 py-0.5 rounded-chip hover:bg-accent/20 transition-colors"
                aria-label="Open map route"
              >
                <Map size={12} aria-hidden="true" />
                Route
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Pin list */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <PinCardSkeleton key={`skeleton-${i}`} />
            ))}
          </div>
        ) : (
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {pins.length === 0 ? (
              <p className="text-caption text-ink-3 py-6 text-center border border-dashed border-border rounded-card">
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
                      transition={{ duration: DURATION_FAST, layout: { duration: DURATION_BASE } }}
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
    </div>
  );
}
