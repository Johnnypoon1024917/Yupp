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
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-surface"
          aria-label="Discover feed"
        >
          <Drawer.Handle className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300" />
          <Drawer.Title className="sr-only">Discover</Drawer.Title>

          <div className="max-h-[85vh] overflow-y-auto px-4 py-5">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Your Saved Pins
            </h3>

            {pins.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <MapPin size={32} className="mb-2" />
                <p className="text-sm">No pins yet. Paste a URL to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {pins.map((pin) => (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => {
                      setActivePinId(pin.id);
                      onOpenChange(false);
                    }}
                    className="group relative aspect-square rounded-2xl overflow-hidden border border-border bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pin.imageUrl}
                      alt={pin.title}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    {/* Gradient overlay with title */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="text-xs font-medium text-white truncate">
                        {pin.title}
                      </p>
                      {pin.rating != null && (
                        <span className="text-[10px] text-white/80">
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
