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
          className="fixed inset-x-0 bottom-0 z-[100] mx-auto max-w-md flex flex-col bg-surface rounded-t-[32px] shadow-[0_-8px_40px_rgba(0,0,0,0.12)] outline-none"
          aria-label="Place details"
        >
          <div className="mx-auto mt-4 mb-5 h-1.5 w-12 rounded-full bg-gray-300 flex-shrink-0" />
          <Drawer.Title className="sr-only">
            {pin?.title ?? "Place details"}
          </Drawer.Title>

          {pin && (
            <div className="flex flex-col overflow-y-auto max-h-[80vh]">
              {/* Hero image — full-bleed, edge-to-edge */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pin.imageUrl}
                alt={pin.title}
                className="w-full h-72 object-cover"
              />

              {/* Content */}
              <div className="px-6 py-5 space-y-3">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-primary text-balance leading-tight">
                  {pin.title}
                </h2>

                <div className="flex items-center gap-2 flex-wrap">
                  {pin.primaryType && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-primary text-xs font-semibold rounded-full">
                      {pin.primaryType}
                    </span>
                  )}
                  {pin.rating != null && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-primary text-xs font-semibold rounded-full">
                      ⭐ {pin.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => window.open(pin.sourceUrl, "_blank")}
                  className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
                >
                  View Source
                </button>
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
