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
          className="fixed inset-x-0 bottom-0 z-[100] mx-auto max-w-md flex flex-col bg-surface rounded-t-[32px] shadow-[0_-8px_40px_rgba(0,0,0,0.12)] outline-none"
          aria-label="Discover feed"
        >
          <div className="mx-auto mt-4 mb-5 h-1.5 w-12 rounded-full bg-gray-300 flex-shrink-0" />
          <Drawer.Title className="sr-only">Discover</Drawer.Title>

          <div className="max-h-[85vh] overflow-y-auto px-4 py-1 pb-6">
            <h3 className="text-sm font-medium text-gray-500 tracking-wide mb-4">
              Your Saved Pins
            </h3>

            {pins.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <MapPin size={32} className="mb-2" />
                <p className="text-sm font-medium text-gray-500 tracking-wide">No pins yet. Paste a URL to get started.</p>
              </div>
            ) : (
              <div className="columns-2 gap-2.5 space-y-2.5">
                {pins.map((pin) => (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => {
                      setActivePinId(pin.id);
                      onOpenChange(false);
                    }}
                    className="group relative w-full overflow-hidden rounded-xl bg-gray-50 break-inside-avoid mb-0 focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pin.imageUrl}
                      alt={pin.title}
                      className="w-full object-cover rounded-xl transition-transform duration-200 group-hover:scale-105"
                    />
                    {/* Gradient overlay with title */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 rounded-b-xl">
                      <p className="text-xs font-semibold text-white truncate">
                        {pin.title}
                      </p>
                      {pin.rating != null && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-primary text-xs font-semibold rounded-full mt-1">
                          ⭐ {pin.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
