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
          className="fixed inset-x-0 bottom-0 z-[100] mx-auto w-full max-w-[448px] flex flex-col bg-white rounded-t-[32px] shadow-[0_-12px_48px_rgba(0,0,0,0.12)] outline-none overflow-hidden"
          aria-label="Place details"
        >
          <Drawer.Title className="sr-only">
            {pin?.title ?? "Place details"}
          </Drawer.Title>

          {pin && (
            <div className="relative flex flex-col overflow-y-auto max-h-[85vh]">
              {/* Drag handle — floating over the image */}
              <div className="absolute top-[12px] left-1/2 -translate-x-1/2 z-10 h-[5px] w-[48px] rounded-[100px] bg-white/60 backdrop-blur-md" />

              {/* Hero image — aspect-ratio-safe container with blurred backdrop */}
              <div className="w-full h-[320px] bg-[#F4F4F5] flex items-center justify-center overflow-hidden relative">
                {/* Blurred background layer */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pin.imageUrl}
                  className="absolute inset-0 w-full h-full object-cover blur-xl opacity-50 scale-110"
                  aria-hidden="true"
                  alt=""
                />
                {/* Actual uncropped image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pin.imageUrl}
                  alt={pin.title}
                  className="relative w-full h-full object-contain drop-shadow-md"
                />
              </div>

              {/* Content */}
              <div className="px-[24px] pt-[24px] pb-[32px] flex flex-col gap-[16px]">
                <h2 className="text-[22px] leading-[26px] md:text-[24px] md:leading-[28px] font-bold tracking-[-0.4px] text-[#111111] text-balance">
                  {pin.title}
                </h2>

                <div className="flex flex-wrap items-center gap-[8px]">
                  {pin.primaryType && (
                    <span className="inline-flex items-center px-[12px] py-[6px] bg-[#F4F4F5] text-[#3F3F46] text-[13px] leading-[16px] font-semibold rounded-[100px] tracking-[-0.1px]">
                      {pin.primaryType}
                    </span>
                  )}
                  {pin.rating != null && (
                    <span className="inline-flex items-center px-[12px] py-[6px] bg-[#F4F4F5] text-[#3F3F46] text-[13px] leading-[16px] font-semibold rounded-[100px] tracking-[-0.1px]">
                      ⭐ {pin.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                <p className="text-[15px] leading-[24px] text-[#71717A] tracking-[0.1px] line-clamp-3">
                  Saved from {new URL(pin.sourceUrl).hostname}
                </p>

                <a
                  href={pin.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-[8px] flex items-center justify-center w-full h-[56px] bg-[#111111] text-white text-[16px] leading-[20px] font-semibold rounded-[28px] transition-transform active:scale-[0.97]"
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
