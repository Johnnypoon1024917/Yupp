'use client';

import { Plus } from 'lucide-react';
import usePlannerStore from '@/store/usePlannerStore';
import DayContainer from './DayContainer';

interface TripTimelineProps {
  className?: string;
}

export default function TripTimeline({ className }: TripTimelineProps) {
  const dayItems = usePlannerStore((s) => s.dayItems);
  const addDay = usePlannerStore((s) => s.addDay);
  const isLoadingItinerary = usePlannerStore((s) => s.isLoadingItinerary);

  const dayNumbers = Object.keys(dayItems)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className={className ?? ''}>
      {dayNumbers.length === 0 ? (
        <p className="text-[13px] text-neutral-400 text-center py-12">
          No days yet — add one to start planning
        </p>
      ) : (
        <div className="space-y-6">
          {dayNumbers.map((day) => (
            <DayContainer key={day} dayNumber={day} pins={dayItems[day] ?? []} isLoading={isLoadingItinerary} />
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
