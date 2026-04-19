"use client";

import { Drawer } from "vaul";
import type { Pin } from "@/types";

export interface PlaceSheetProps {
  pin: Pin | null;
  onDismiss: () => void;
}

export default function PlaceSheet({ pin, onDismiss }: PlaceSheetProps) {
  return (
    <Drawer.Root
      open={pin !== null}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[100] mx-auto w-full max-w-md flex flex-col bg-white rounded-t-[36px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] outline-none overflow-hidden"
          aria-label="Place details"
        >
          <Drawer.Title className="sr-only">
            {pin?.title ?? "Place details"}
          </Drawer.Title>

          {pin && (
            <div className="relative flex flex-col overflow-y-auto max-h-[85vh]">
              {/* Drag handle — floating over the image */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 h-1.5 w-12 rounded-full bg-white/50 backdrop-blur-md" />

              {/* Hero image — flush to top, left, right edges */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pin.imageUrl}
                alt={pin.title}
                className="w-full aspect-[4/3] sm:aspect-video object-cover"
              />

              {/* Content */}
              <div className="px-6 py-8 flex flex-col gap-4">
                <h2 className="text-[28px] leading-[1.1] sm:text-3xl font-bold tracking-tighter text-black text-balance">
                  {pin.title}
                </h2>

                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {pin.primaryType && (
                    <span className="inline-flex items-center px-3.5 py-1.5 bg-gray-100 text-gray-900 text-xs sm:text-sm font-semibold rounded-full tracking-wide">
                      {pin.primaryType}
                    </span>
                  )}
                  {pin.rating != null && (
                    <span className="inline-flex items-center px-3.5 py-1.5 bg-gray-100 text-gray-900 text-xs sm:text-sm font-semibold rounded-full tracking-wide">
                      ⭐ {pin.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                <p className="text-sm sm:text-base text-gray-500 leading-relaxed tracking-normal line-clamp-3">
                  Saved from {new URL(pin.sourceUrl).hostname}
                </p>

                <a
                  href={pin.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center w-full bg-black text-white text-base font-semibold rounded-[20px] py-4 transition-transform active:scale-[0.98]"
                >
                  View Source
                </a>
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
