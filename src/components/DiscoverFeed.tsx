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
          className="fixed inset-x-0 bottom-0 z-[100] mx-auto w-full max-w-[448px] h-[85vh] flex flex-col bg-[#FAFAFA] rounded-t-[32px] shadow-[0_-12px_48px_rgba(0,0,0,0.12)] outline-none"
          aria-label="Discover feed"
        >
          <Drawer.Title className="sr-only">Discover</Drawer.Title>

          {/* Header */}
          <div className="px-[24px] pt-[32px] pb-[16px] flex flex-col gap-[4px] bg-white rounded-t-[32px]">
            <div className="mx-auto mb-[16px] h-[5px] w-[48px] rounded-[100px] bg-[#D4D4D8] flex-shrink-0" />
            <h1 className="text-[24px] leading-[28px] font-bold tracking-[-0.5px] text-[#111111]">
              Saved Places
            </h1>
            <p className="text-[13px] leading-[16px] text-[#A1A1AA] tracking-[0.1px]">
              {pins.length} {pins.length === 1 ? 'place' : 'places'} saved
            </p>
          </div>

          {/* Scrollable grid */}
          {pins.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <MapPin size={36} className="mb-[12px] text-[#D4D4D8]" />
              <p className="text-[15px] leading-[24px] text-[#A1A1AA] tracking-[0.1px]">
                No pins yet. Paste a URL to get started.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-[16px] py-[16px] grid grid-cols-2 gap-[12px] pb-[100px] auto-rows-min">
              {pins.map((pin) => (
                <button
                  key={pin.id}
                  type="button"
                  onClick={() => {
                    setActivePinId(pin.id);
                    onOpenChange(false);
                  }}
                  className="relative w-full aspect-[4/5] rounded-[16px] overflow-hidden group cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
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
                  <div className="absolute bottom-0 left-0 p-[16px] w-full">
                    <h3 className="text-white font-bold text-[15px] leading-[20px] tracking-[-0.2px] line-clamp-2 drop-shadow-md">
                      {pin.title}
                    </h3>
                    {pin.rating != null && (
                      <p className="text-white/70 text-[12px] leading-[16px] mt-[4px]">
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
