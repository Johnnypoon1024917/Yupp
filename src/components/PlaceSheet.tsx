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
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-white"
          aria-label="Place details"
        >
          <Drawer.Handle className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300" />
          <Drawer.Title className="sr-only">
            {pin?.title ?? "Place details"}
          </Drawer.Title>

          {pin && (
            <div className="flex flex-col overflow-y-auto max-h-[80vh]">
              {/* Hero image — full-bleed */}
              <div className="relative w-full aspect-video">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pin.imageUrl}
                  alt={pin.title}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Content */}
              <div className="px-4 py-4 space-y-3">
                <h2 className="text-2xl tracking-tight font-semibold">
                  {pin.title}
                </h2>

                <div className="flex items-center gap-2 flex-wrap">
                  {pin.primaryType && (
                    <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {pin.primaryType}
                    </span>
                  )}
                  {pin.rating != null && (
                    <span className="text-sm text-gray-600">
                      ⭐ {pin.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => window.open(pin.sourceUrl, "_blank")}
                  className="w-full rounded-lg py-3 text-sm font-medium text-white"
                  style={{ backgroundColor: "#6366F1" }}
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
