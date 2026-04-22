'use client';

import { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Search, GripVertical, MapPin } from 'lucide-react';
import useTravelPinStore from '@/store/useTravelPinStore';
import { extractCountry } from '@/utils/address';
import type { Pin } from '@/types';

interface LibraryPaneProps {
  className?: string;
}

/**
 * Extracts the city name from a pin's address using a regex that grabs
 * the second-to-last comma segment (typically the city).
 * Falls back to the last segment, then "Unknown Location".
 */
export function extractCity(address: string | undefined): string {
  if (!address || !address.trim()) return 'Unknown Location';
  const segments = address.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length >= 2) return segments[segments.length - 2];
  return segments[0] || 'Unknown Location';
}

/**
 * Groups pins by their derived city key.
 */
export function groupPinsByCity(pins: Pin[]): Record<string, Pin[]> {
  const groups: Record<string, Pin[]> = {};
  for (const pin of pins) {
    const city = extractCity(pin.address);
    if (!groups[city]) groups[city] = [];
    groups[city].push(pin);
  }
  return groups;
}

/**
 * Groups pins by their derived country key.
 */
export function groupPinsByCountry(pins: Pin[]): Record<string, Pin[]> {
  const groups: Record<string, Pin[]> = {};
  for (const pin of pins) {
    const country = extractCountry(pin.address);
    if (!groups[country]) groups[country] = [];
    groups[country].push(pin);
  }
  return groups;
}

/**
 * Filters pins by a case-insensitive query matching title or city name.
 */
export function filterPins(pins: Pin[], query: string): Pin[] {
  if (!query.trim()) return pins;
  const lower = query.toLowerCase();
  return pins.filter(
    (pin) =>
      pin.title.toLowerCase().includes(lower) ||
      extractCity(pin.address).toLowerCase().includes(lower)
  );
}

export default function LibraryPane({ className }: LibraryPaneProps) {
  const pins = useTravelPinStore((s) => s.pins);
  const [search, setSearch] = useState('');
  const [groupMode, setGroupMode] = useState<'city' | 'country'>('city');

  const filteredGroups = useMemo(() => {
    const filtered = filterPins(pins, search);
    return groupMode === 'country' ? groupPinsByCountry(filtered) : groupPinsByCity(filtered);
  }, [pins, search, groupMode]);

  const cityNames = Object.keys(filteredGroups).sort();

  return (
    <div className={`flex flex-col ${className ?? ''}`}>
      {/* City / Country segmented toggle */}
      <div className="px-4 pt-4 pb-2 flex gap-1">
        {(['city', 'country'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setGroupMode(mode)}
            className={`flex-1 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
              groupMode === mode
                ? 'bg-accent text-white'
                : 'bg-[#F0F0F0] text-neutral-500 hover:bg-[#E5E5E5]'
            }`}
          >
            {mode === 'city' ? 'City' : 'Country'}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="px-4 pb-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by title or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[13px] rounded-lg bg-[#FAFAFA] border border-gray-200 focus:outline-none focus:ring-2 focus:ring-accent/40 placeholder:text-neutral-400"
          />
        </div>
      </div>

      {/* Scrollable pin grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {cityNames.length === 0 && (
          <p className="text-[13px] text-neutral-400 text-center py-8">
            {pins.length === 0 ? 'No saved pins yet' : 'No pins match your search'}
          </p>
        )}

        {cityNames.map((city) => (
          <div key={city}>
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin className="w-3.5 h-3.5 text-accent" />
              <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                {city}
              </h3>
              <span className="text-[11px] text-neutral-400">
                ({filteredGroups[city].length})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {filteredGroups[city].map((pin) => (
                <DraggablePinCard key={pin.id} pin={pin} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraggablePinCard({ pin }: { pin: Pin }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${pin.id}`,
    data: { type: 'library-pin', pin },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`group rounded-card bg-white border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-40 scale-95' : ''
      }`}
    >
      {/* 4:5 aspect-ratio image */}
      <div className="relative aspect-[4/5] bg-neutral-100">
        {pin.imageUrl ? (
          <img
            src={pin.imageUrl}
            alt={pin.title}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300">
            <MapPin className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Title + drag affordance */}
      <div className="flex items-center gap-1 p-2">
        <p className="flex-1 text-[13px] font-bold tracking-tight text-[#111111] truncate">
          {pin.title}
        </p>
        <div className="flex items-center text-neutral-400 group-hover:text-accent transition-colors shrink-0">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
