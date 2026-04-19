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

  const dayNumbers = Object.keys(dayItems)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className={`flex flex-col ${className ?? ''}`}>
      {/* Scrollable day list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {dayNumbers.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-8">
            No days yet — add one to start planning
          </p>
        ) : (
          dayNumbers.map((day) => (
            <DayContainer key={day} dayNumber={day} pins={dayItems[day] ?? []} />
          ))
        )}

        {/* Add Day button */}
        <button
          onClick={addDay}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-border text-sm text-neutral-500 hover:border-accent hover:text-accent transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Day
        </button>
      </div>
    </div>
  );
}
