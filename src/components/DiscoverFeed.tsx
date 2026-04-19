'use client';

import { Drawer } from 'vaul';
import { MapPin } from 'lucide-react';
import useTravelPinStore from '@/store/useTravelPinStore';

export interface DiscoverFeedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DiscoverFeed({ open, onOpenChange }: DiscoverFeedProps) {
  const pins = useTravelPinStore((s) => s.pins);
  const setActivePinId = useTravelPinStore((s) => s.setActivePinId);

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[100] mx-auto w-full max-w-md h-[85vh] flex flex-col bg-[#F9F9F9] rounded-t-[36px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] outline-none"
          aria-label="Discover feed"
        >
          <Drawer.Title className="sr-only">Discover</Drawer.Title>

          {/* Header */}
          <div className="px-6 pt-8 pb-4 flex flex-col gap-1 bg-white rounded-t-[36px]">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300 flex-shrink-0" />
            <h1 className="text-3xl font-extrabold tracking-tighter text-black">
              Saved Places
            </h1>
            <p className="text-sm text-gray-400 tracking-normal">
              {pins.length} {pins.length === 1 ? 'place' : 'places'} saved
            </p>
          </div>

          {/* Scrollable grid */}
          {pins.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MapPin size={36} className="mb-3" />
              <p className="text-sm font-medium text-gray-400 tracking-wide">
                No pins yet. Paste a URL to get started.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-4 grid grid-cols-2 gap-3 sm:gap-4 pb-24 auto-rows-min">
              {pins.map((pin) => (
                <button
                  key={pin.id}
                  type="button"
                  onClick={() => {
                    setActivePinId(pin.id);
                    onOpenChange(false);
                  }}
                  className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden group cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pin.imageUrl}
                    alt={pin.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  {/* Text content docked at bottom */}
                  <div className="absolute bottom-0 left-0 p-4 w-full">
                    <h3 className="text-white font-bold text-sm sm:text-base leading-tight tracking-tight line-clamp-2">
                      {pin.title}
                    </h3>
                    {pin.rating != null && (
                      <p className="text-white/70 text-xs mt-1">
                        ⭐ {pin.rating.toFixed(1)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
