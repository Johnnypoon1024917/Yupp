'use client';

export interface BridgeElementProps {
  distance: string;   // e.g., "2.4 km"
  duration: string;   // e.g., "12 mins"
  mode: 'transit' | 'driving';
  isLoading?: boolean;
}

/** Bridge between consecutive timeline cards showing travel mode icon and duration. */
export default function BridgeElement({ distance, duration, mode, isLoading }: BridgeElementProps) {
  const icon = mode === 'driving' ? '🚗' : '🚶';
  const hasData = distance && duration;

  return (
    <div className="flex items-center justify-center py-1.5">
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        <span className="w-px h-3 bg-border" />
        {isLoading ? (
          <span className="animate-pulse">···</span>
        ) : hasData ? (
          <span>
            {icon} {duration}
          </span>
        ) : (
          <span>—</span>
        )}
        <span className="w-px h-3 bg-border" />
      </div>
    </div>
  );
}
