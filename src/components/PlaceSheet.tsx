"use client";

import { useState, useCallback } from "react";
import { Drawer } from "vaul";
import { Share2, FolderOpen, Check } from "lucide-react";
import useTravelPinStore from "@/store/useTravelPinStore";
import type { Pin } from "@/types";

export interface PlaceSheetProps {
  pin: Pin | null;
  onDismiss: () => void;
}

export default function PlaceSheet({ pin, onDismiss }: PlaceSheetProps) {
  const removePin = useTravelPinStore((s) => s.removePin);
  const movePin = useTravelPinStore((s) => s.movePin);
  const collections = useTravelPinStore((s) => s.collections);
  const setActivePinId = useTravelPinStore((s) => s.setActivePinId);

  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);

  const currentCollection = collections.find(
    (c) => c.id === pin?.collectionId
  );

  const handleRemove = useCallback(() => {
    if (!pin) return;
    const confirmed = window.confirm(
      "Are you sure you want to remove this pin?"
    );
    if (!confirmed) return;
    removePin(pin.id);
    setActivePinId(null);
    onDismiss();
  }, [pin, removePin, setActivePinId, onDismiss]);

  const handleShare = useCallback(async () => {
    if (!pin) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: pin.title,
          text: pin.address ?? pin.title,
          url: pin.sourceUrl,
        });
      } catch {
        // User cancelled or share failed — no-op
      }
    } else {
      await navigator.clipboard.writeText(pin.sourceUrl);
    }
  }, [pin]);

  const handleMoveToCollection = useCallback(
    (collectionId: string) => {
      if (!pin) return;
      movePin(pin.id, collectionId);
      setCollectionPickerOpen(false);
    },
    [pin, movePin]
  );

  return (
    <Drawer.Root
      open={pin !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCollectionPickerOpen(false);
          onDismiss();
        }
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[100] mx-auto w-full max-w-[448px] flex flex-col bg-white rounded-t-[32px] shadow-[0_-20px_80px_rgba(0,0,0,0.1)] outline-none overflow-hidden"
          aria-label="Place details"
        >
          <Drawer.Title className="sr-only">
            {pin?.title ?? "Place details"}
          </Drawer.Title>

          {pin && (
            <div className="relative flex flex-col overflow-y-auto max-h-[85vh]">
              {/* Drag handle — floating over the image */}
              <div className="absolute top-[16px] left-1/2 -translate-x-1/2 z-20 h-[5px] w-[40px] rounded-full bg-white/40 backdrop-blur-md" />

              {/* Share button — top right of hero */}
              <button
                type="button"
                onClick={handleShare}
                className="absolute top-4 right-4 z-20 p-2 bg-white/20 backdrop-blur-md rounded-full text-white active:opacity-60 transition-opacity"
                aria-label="Share this place"
              >
                <Share2 size={20} />
              </button>

              {/* Hero image — 4:5 aspect-ratio-safe container with blurred backdrop */}
              <div className="relative w-full aspect-[4/5] bg-[#F4F4F5] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pin.imageUrl}
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-110"
                  aria-hidden="true"
                  alt=""
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pin.imageUrl}
                  alt={pin.title}
                  className="relative w-full h-full object-contain"
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
              </div>

              {/* Content — strict hierarchy: Name → Location → Collection → Badges → Description */}
              <div className="px-[24px] pt-[20px] pb-[40px] flex flex-col">
                {/* 1. Name */}
                <h2
                  className="text-[26px] leading-[30px] font-extrabold tracking-[-0.8px] text-[#111111] text-balance"
                  style={{ margin: 0 }}
                >
                  {pin.title}
                </h2>

                {/* 2. Location — tappable, opens Google Maps */}
                {pin.address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin.address)}&query_place_id=${pin.placeId ?? ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] leading-[18px] text-[#71717A] tracking-[-0.1px] mt-[6px] underline decoration-[#D4D4D8] underline-offset-2 hover:text-[#3F3F46] transition-colors"
                  >
                    {pin.address}
                  </a>
                )}

                {/* 3. Collection picker */}
                <div className="relative mt-[8px]">
                  <button
                    type="button"
                    onClick={() => setCollectionPickerOpen((v) => !v)}
                    className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg text-[13px] font-medium text-gray-600 active:bg-gray-100 transition-colors"
                  >
                    <FolderOpen size={14} />
                    {currentCollection?.name ?? "Unorganized"}
                  </button>

                  {/* Collection dropdown */}
                  {collectionPickerOpen && (
                    <div className="absolute top-full left-0 mt-[6px] w-[220px] bg-white rounded-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[#F4F4F5] z-30 py-[6px] overflow-hidden">
                      {collections.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleMoveToCollection(c.id)}
                          className="w-full flex items-center justify-between px-[14px] py-[10px] text-[13px] text-[#3F3F46] hover:bg-[#F4F4F5] transition-colors text-left"
                        >
                          <span className="truncate font-medium">{c.name}</span>
                          {pin.collectionId === c.id && (
                            <Check size={14} className="text-[#22C55E] flex-shrink-0 ml-2" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Badges — type + rating pills */}
                {(pin.primaryType || pin.rating != null) && (
                  <div className="flex flex-wrap items-center gap-[8px] mt-[14px]">
                    {pin.primaryType && (
                      <span className="inline-flex items-center px-[10px] py-[5px] bg-[#F4F4F5] text-[#3F3F46] text-[11px] font-bold uppercase tracking-[0.6px] rounded-full">
                        {pin.primaryType.replace(/_/g, " ")}
                      </span>
                    )}
                    {pin.rating != null && (
                      <span className="inline-flex items-center gap-[3px] px-[10px] py-[5px] bg-[#FEF9C3] text-[#854D0E] text-[11px] font-bold tracking-[0.4px] rounded-full">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        {pin.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                )}

                {/* 5. Description or source fallback */}
                {pin.description ? (
                  <p className="text-[15px] leading-[22px] text-[#52525B] tracking-[-0.1px] line-clamp-4 mt-[16px]">
                    {pin.description}
                  </p>
                ) : (
                  <p className="text-[15px] leading-[22px] text-[#71717A] italic mt-[16px]">
                    Saved from{" "}
                    <span className="font-medium not-italic text-[#52525B]">
                      {new URL(pin.sourceUrl).hostname}
                    </span>
                  </p>
                )}

                {/* Divider */}
                <div className="h-px bg-[#F4F4F5] mt-[20px] mb-[16px]" />

                {/* Meta row — source + coordinates */}
                <div className="flex items-baseline justify-between">
                  <p className="text-[12px] leading-[16px] text-[#A1A1AA] tracking-[0.08px]">
                    via{" "}
                    <span className="font-medium text-[#71717A]">
                      {new URL(pin.sourceUrl).hostname}
                    </span>
                  </p>
                  <p className="text-[11px] leading-[16px] text-[#D4D4D8] tracking-[0.4px] font-mono">
                    {pin.latitude.toFixed(4)}°, {pin.longitude.toFixed(4)}°
                  </p>
                </div>

                {/* CTA Button */}
                <a
                  href={pin.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-[24px] h-[56px] w-full bg-[#111111] text-white text-[15px] font-bold rounded-[16px] flex items-center justify-center gap-[8px] transition-all active:scale-[0.97] hover:bg-[#222222]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  View Source
                </a>

                {/* Remove Pin — destructive secondary action */}
                <button
                  type="button"
                  onClick={handleRemove}
                  className="mt-4 text-[14px] font-semibold text-red-500 py-2 active:opacity-60 transition-opacity"
                >
                  Remove from Map
                </button>
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
