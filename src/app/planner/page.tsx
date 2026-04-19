'use client';

import { useEffect } from 'react';
import DraftingTable from '@/components/planner/DraftingTable';
import ItineraryToolbar from '@/components/planner/ItineraryToolbar';
import usePlannerStore from '@/store/usePlannerStore';

export default function PlannerPage() {
  const fetchItineraries = usePlannerStore((s) => s.fetchItineraries);

  useEffect(() => {
    fetchItineraries();
  }, [fetchItineraries]);

  return (
    <div
      className="relative w-screen h-[100dvh] overflow-hidden flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <ItineraryToolbar />
      <div className="flex-1 min-h-0">
        <DraftingTable />
      </div>
    </div>
  );
}
