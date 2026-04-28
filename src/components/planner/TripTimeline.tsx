'use client';

import { Plus } from 'lucide-react';
import usePlannerStore from '@/store/usePlannerStore';
import DayContainer from './DayContainer';
import EmptyState from '@/components/empty-states/EmptyState';
import CalendarIllustration from '@/components/empty-states/illustrations/CalendarIllustration';

interface TripTimelineProps {
  className?: string;
  onOpenLibrary?: () => void;
}

export default function TripTimeline({ className, onOpenLibrary }: TripTimelineProps) {
  const dayItems = usePlannerStore((s) => s.dayItems);
  const addDay = usePlannerStore((s) => s.addDay);
  const isLoadingItinerary = usePlannerStore((s) => s.isLoadingItinerary);
  const tripDate = usePlannerStore((s) => s.activeItinerary?.tripDate ?? null);

  const dayNumbers = Object.keys(dayItems)
    .map(Number)
    .sort((a, b) => a - b);

  const totalPlannedPins = dayNumbers.reduce(
    (sum, day) => sum + (dayItems[day]?.length ?? 0),
    0,
  );

  return (
    <div className={className ?? ''}>
      {totalPlannedPins === 0 ? (
        <EmptyState
          illustration={<CalendarIllustration />}
          message="Drag pins here to plan your day"
          ctaLabel="Browse saved places"
          onCtaClick={onOpenLibrary}
        />
      ) : (
        <div className="space-y-6">
          {dayNumbers.map((day) => (
            <DayContainer key={day} dayNumber={day} pins={dayItems[day] ?? []} isLoading={isLoadingItinerary} tripDate={tripDate} />
          ))}
        </div>
      )}

      {/* Add Day button */}
      <button
        onClick={addDay}
        className="w-full flex items-center justify-center gap-1.5 py-3 mt-6 rounded-lg border border-dashed border-gray-300 text-[13px] font-bold tracking-tight text-neutral-500 hover:border-accent hover:text-accent transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Day
      </button>
    </div>
  );
}
