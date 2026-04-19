'use client';

import { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Search, GripVertical, MapPin } from 'lucide-react';
import useTravelPinStore from '@/store/useTravelPinStore';
import type { Pin } from '@/types';

interface SavedLibraryProps {
  className?: string;
}

/**
 * Extracts the city/region from a pin's address by taking the last
 * comma-separated segment. Falls back to "Unknown Location" if no address.
 */
export function extractRegion(address: string | undefined): string {
  if (!address || !address.trim()) return 'Unknown Location';
  const segments = address.split(',').map((s) => s.trim());
  return segments[segments.length - 1] || 'Unknown Location';
}

/**
 * Groups pins by their derived city/region key.
 */
export function groupPinsByRegion(pins: Pin[]): Record<string, Pin[]> {
  const groups: Record<string, Pin[]> = {};
  for (const pin of pins) {
    const region = extractRegion(pin.address);
    if (!groups[region]) groups[region] = [];
    groups[region].push(pin);
  }
  return groups;
}

/**
 * Filters pins by a case-insensitive query matching title or address.
 */
export function filterPins(pins: Pin[], query: string): Pin[] {
  if (!query.trim()) return pins;
  const lower = query.toLowerCase();
  return pins.filter(
    (pin) =>
      pin.title.toLowerCase().includes(lower) ||
      (pin.address && pin.address.toLowerCase().includes(lower))
  );
}

export default function SavedLibrary({ className }: SavedLibraryProps) {
  const pins = useTravelPinStore((s) => s.pins);
  const [search, setSearch] = useState('');

  const filteredGroups = useMemo(() => {
    const filtered = filterPins(pins, search);
    return groupPinsByRegion(filtered);
  }, [pins, search]);

  const regionNames = Object.keys(filteredGroups).sort();

  return (
    <div className={`flex flex-col ${className ?? ''}`}>
      {/* Search input */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search saved pins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/40 placeholder:text-neutral-400"
          />
        </div>
      </div>

      {/* Scrollable pin list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {regionNames.length === 0 && (
          <p className="text-sm text-neutral-400 text-center py-8">
            {pins.length === 0 ? 'No saved pins yet' : 'No pins match your search'}
          </p>
        )}

        {regionNames.map((region) => (
          <div key={region}>
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin className="w-3.5 h-3.5 text-accent" />
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                {region}
              </h3>
              <span className="text-xs text-neutral-400">
                ({filteredGroups[region].length})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {filteredGroups[region].map((pin) => (
                <PinCard key={pin.id} pin={pin} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PinCard({ pin }: { pin: Pin }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${pin.id}`,
    data: { type: 'library-pin', pin },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`group rounded-card bg-surface border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-grab ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      {/* 4:5 aspect-ratio image */}
      <div className="relative aspect-[4/5] bg-neutral-100">
        {pin.imageUrl ? (
          <img
            src={pin.imageUrl}
            alt={pin.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300">
            <MapPin className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Title + drag affordance */}
      <div className="flex items-center gap-1 p-2">
        <p className="flex-1 text-xs font-medium text-primary truncate">
          {pin.title}
        </p>
        <div className="flex items-center gap-0.5 text-neutral-400 group-hover:text-accent transition-colors shrink-0">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
