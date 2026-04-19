'use client';

import { useState } from 'react';
import { DndContext, DragOverlay, rectIntersection } from '@dnd-kit/core';
import { ChevronDown, ChevronUp } from 'lucide-react';
import usePlannerDnd from '@/hooks/usePlannerDnd';
import LibraryPane from './LibraryPane';
import TripTimeline from './TripTimeline';

export default function DraftingTable() {
  const { sensors, activeDrag, handleDragStart, handleDragEnd, DragPreview } =
    usePlannerDnd();

  const [mobileLibOpen, setMobileLibOpen] = useState(true);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Desktop: side-by-side */}
      <div className="hidden md:flex w-full h-full">
        <LibraryPane className="w-[35%] h-full border-r border-gray-200 bg-white flex flex-col" />
        <TripTimeline className="flex-1 h-full overflow-y-auto px-8 py-12" />
      </div>

      {/* Mobile: vertical stack with collapsible library */}
      <div className="flex flex-col w-full h-full md:hidden">
        <button
          onClick={() => setMobileLibOpen((v) => !v)}
          className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 text-[13px] font-bold tracking-tight text-[#111111]"
        >
          <span>Saved Library</span>
          {mobileLibOpen ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </button>
        {mobileLibOpen && (
          <LibraryPane className="h-[40vh] bg-white border-b border-gray-200 flex flex-col shrink-0" />
        )}
        <TripTimeline className="flex-1 min-h-0 overflow-y-auto px-4 py-6" />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag ? <DragPreview data={activeDrag} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
