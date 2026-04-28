'use client';

import type { DistanceSegment } from '@/hooks/useDistanceMatrix';

export interface BridgeElementProps {
  distance?: DistanceSegment;
  isLoading?: boolean;
}

const modeIcons: Record<DistanceSegment['mode'], string> = {
  driving: '🚗',
  transit: '🚶',
};

/**
 * Visual connector between timeline cards.
 * Renders one of three states:
 * 1. Loading → pulsing skeleton
 * 2. Data available → mode icon + duration + distance
 * 3. Fallback → neutral dashed connector line
 */
export default function BridgeElement({ distance, isLoading }: BridgeElementProps) {
  // Loading state: pulsing skeleton placeholder
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <div className="flex items-center gap-2 animate-pulse">
          <span className="w-0 h-5 border-l border-dashed border-neutral-300" />
          <span className="h-3 w-20 rounded bg-neutral-200" />
          <span className="w-0 h-5 border-l border-dashed border-neutral-300" />
        </div>
      </div>
    );
  }

  // Data display state: show mode icon, duration, and distance
  if (distance) {
    return (
      <div className="flex items-center justify-center py-2">
        <div className="flex items-center gap-2">
          <span className="w-0 h-5 border-l border-dashed border-neutral-300" />
          <span className="text-[11px] text-neutral-500">
            {modeIcons[distance.mode]} {distance.duration} · {distance.distance}
          </span>
          <span className="w-0 h-5 border-l border-dashed border-neutral-300" />
        </div>
      </div>
    );
  }

  // Fallback state: neutral dashed connector line, no text or icons
  return (
    <div className="flex items-center justify-center py-2">
      <span className="w-0 h-5 border-l border-dashed border-neutral-300" />
    </div>
  );
}
