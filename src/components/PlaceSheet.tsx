"use client";

import { useState, useCallback, useEffect } from "react";
import { Drawer } from "vaul";
import { Share2, FolderOpen, Check, Plus, Pencil, Utensils, Bed, Camera, ShoppingBag, MapPin, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import useTravelPinStore from "@/store/useTravelPinStore";
import useToastStore from "@/store/useToastStore";
import { getAffiliateLink } from "@/utils/affiliateLinks";
import { getCategoryGradient, getCategoryIcon } from "@/utils/categories";
import { getGoogleMapsPlaceUrl } from "@/utils/mapExport";
import { trackReferralClick } from "@/actions/trackReferralClick";
import { trackEvent } from "@/components/AnalyticsProvider";
import { EVENTS } from "@/utils/analytics";
import PinImage from "@/components/PinImage";
import type { Pin } from "@/types";

const ICON_MAP: Record<string, LucideIcon> = {
  utensils: Utensils,
  bed: Bed,
  camera: Camera,
  "shopping-bag": ShoppingBag,
  "map-pin": MapPin,
};

/**
 * Determine if a place is currently open based on its openingHours strings.
 * Each entry is expected to look like "Mon: 9:00 AM – 5:00 PM" or "Mon: Closed".
 * Returns true (open), false (closed), or null (cannot determine).
 */
export function isOpenNow(openingHours: string[], now: Date = new Date()): boolean | null {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayPrefix = dayNames[now.getDay()];

  const todayEntry = openingHours.find((h) => h.startsWith(todayPrefix));
  if (!todayEntry) return null;

  // Check for explicit closed
  if (/closed/i.test(todayEntry)) return false;

  // Try to parse time range, e.g. "Mon: 9:00 AM – 5:00 PM" or "Mon: 9AM-5PM"
  const timeRangeMatch = todayEntry.match(
    /(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*[–\-]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i
  );
  if (!timeRangeMatch) return null;

  const parseTime = (str: string): number => {
    const cleaned = str.trim().toUpperCase();
    const m = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
    if (!m) return -1;
    let hours = parseInt(m[1], 10);
    const minutes = m[2] ? parseInt(m[2], 10) : 0;
    const period = m[3];
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const openMin = parseTime(timeRangeMatch[1]);
  const closeMin = parseTime(timeRangeMatch[2]);
  if (openMin < 0 || closeMin < 0) return null;

  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Handle overnight ranges (e.g. 10 PM – 2 AM)
  if (closeMin <= openMin) {
    return nowMin >= openMin || nowMin < closeMin;
  }
  return nowMin >= openMin && nowMin < closeMin;
}

export interface PlaceSheetProps {
  pin: Pin | null;
  onDismiss: () => void;
}

export default function PlaceSheet({ pin, onDismiss }: PlaceSheetProps) {
  const removePin = useTravelPinStore((s) => s.removePin);
  const movePin = useTravelPinStore((s) => s.movePin);
  const addCollection = useTravelPinStore((s) => s.addCollection);
  const updatePin = useTravelPinStore((s) => s.updatePin);
  const collections = useTravelPinStore((s) => s.collections);
  const setActivePinId = useTravelPinStore((s) => s.setActivePinId);

  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [hoursExpanded, setHoursExpanded] = useState(false);

  const affiliateResult = pin ? getAffiliateLink(pin) : null;

  // Track pin_viewed when a pin is displayed
  useEffect(() => {
    if (pin) {
      trackEvent(EVENTS.PIN_VIEWED, {
        pin_id: pin.id,
        source_platform: pin.sourceUrl ? 'unknown' : 'unknown',
      });
    }
  }, [pin?.id]);

  const currentCollection = collections.find(
    (c) => c.id === pin?.collectionId
  );

  const collectionName = currentCollection?.name ?? "Unorganized";

  const addUndoToast = useToastStore((s) => s.addUndoToast);
  const addPendingDelete = useToastStore((s) => s.addPendingDelete);
  const removePendingDelete = useToastStore((s) => s.removePendingDelete);

  const handleRemove = useCallback(() => {
    if (!pin) return;
    // Snapshot the pin before removal
    const pinSnapshot = { ...pin };
    // Optimistic local removal (removePin also fires cloud delete)
    removePin(pin.id);
    // Track in pending-delete localStorage queue
    addPendingDelete(pin.id, pinSnapshot);
    // Show undo toast — on undo, restore pin and clear pending delete
    addUndoToast("Pin removed", () => {
      useTravelPinStore.setState((state) => ({
        pins: [...state.pins, pinSnapshot],
      }));
      removePendingDelete(pin.id);
    });
    setActivePinId(null);
    onDismiss();
  }, [pin, removePin, setActivePinId, onDismiss, addUndoToast, addPendingDelete, removePendingDelete]);

  const handleShare = useCallback(async () => {
    if (!pin) return;
    trackEvent(EVENTS.TRIP_SHARED, {
      itinerary_id: '',
      share_method: 'share' in navigator ? 'native' : 'clipboard',
    });
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

  const handleCreateCollection = useCallback(() => {
    if (!pin) return;
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    const newCollection = addCollection(trimmed);
    movePin(pin.id, newCollection.id);
    setCollectionPickerOpen(false);
    setIsCreatingCollection(false);
    setNewCollectionName("");
  }, [pin, newCollectionName, addCollection, movePin]);

  const handleStartEditing = useCallback(() => {
    if (!pin) return;
    setEditTitle(pin.title);
    setEditDescription(pin.description ?? "");
    setIsEditing(true);
  }, [pin]);

  const handleSaveEdit = useCallback(() => {
    if (!pin) return;
    updatePin(pin.id, { title: editTitle, description: editDescription });
    setIsEditing(false);
  }, [pin, updatePin, editTitle, editDescription]);

  return (
    <Drawer.Root
      open={pin !== null}
      dismissible={!isEditing}
      onOpenChange={(open) => {
        if (!open) {
          setCollectionPickerOpen(false);
          setIsCreatingCollection(false);
          setNewCollectionName("");
          setIsEditing(false);
          setEditTitle("");
          setEditDescription("");
          setHoursExpanded(false);
          onDismiss();
        }
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[100] mx-auto w-full max-w-[448px] flex flex-col bg-white rounded-t-sheet shadow-elev-modal outline-none overflow-hidden"
          aria-label="Place details"
        >
          <Drawer.Title className="sr-only">
            {pin?.title ?? "Place details"}
          </Drawer.Title>

          {pin && (
            <div className="relative flex flex-col max-h-[85vh]">
            <div className="relative flex flex-col overflow-y-auto flex-1">
              {/* Drag handle — floating over the image */}
              <div className="absolute top-[16px] left-1/2 -translate-x-1/2 z-20 h-[5px] w-[40px] rounded-full bg-white/40 backdrop-blur-md" aria-hidden="true" />

              {/* Share button — top right of hero */}
              <button
                type="button"
                onClick={handleShare}
                className="absolute top-4 right-4 z-20 p-2 bg-white/20 backdrop-blur-md rounded-full text-white active:opacity-60 transition-opacity"
                aria-label="Share this place"
              >
                <Share2 size={20} aria-hidden="true" />
              </button>

              {/* Hero image — 4:5 aspect-ratio-safe container with blurred backdrop */}
              {(() => {
                // Build carousel images: pin.imageUrl first, then pin.images
                const carouselImages: string[] = [];
                if (pin.imageUrl) carouselImages.push(pin.imageUrl);
                if (pin.images && pin.images.length > 0) {
                  for (const img of pin.images) {
                    if (!carouselImages.includes(img)) carouselImages.push(img);
                  }
                }

                // Multiple images → horizontally swipeable carousel
                if (carouselImages.length > 1) {
                  return (
                    <div className="relative w-full aspect-[4/5] bg-surface-sunken overflow-hidden">
                      <div
                        className="flex w-full h-full overflow-x-auto"
                        style={{
                          scrollSnapType: 'x mandatory',
                          WebkitOverflowScrolling: 'touch',
                        }}
                        role="region"
                        aria-label="Photo carousel"
                      >
                        {carouselImages.map((imgUrl, i) => (
                          <div
                            key={imgUrl}
                            className="w-full h-full flex-shrink-0"
                            style={{ scrollSnapAlign: 'start' }}
                          >
                            <PinImage
                              src={imgUrl}
                              alt={`${pin.title} photo ${i + 1}`}
                              pinId={`${pin.id}-${i}`}
                              aspectRatio="4/5"
                              className="w-full h-full"
                              sizes="(max-width: 448px) 100vw, 448px"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" aria-hidden="true" />
                    </div>
                  );
                }

                // Single image or imageUrl only → existing behavior
                if (pin.imageUrl) {
                  return (
                    <div className="relative w-full aspect-[4/5] bg-surface-sunken overflow-hidden">
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
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" aria-hidden="true" />
                    </div>
                  );
                }

                // No image → category gradient fallback
                return (
                  <div className={`relative w-full aspect-[4/5] ${getCategoryGradient(collectionName)} overflow-hidden flex items-center justify-center`}>
                    {(() => {
                      const IconComponent = ICON_MAP[getCategoryIcon(collectionName)] ?? ICON_MAP["map-pin"];
                      return <IconComponent size={64} className="text-white/70" aria-hidden="true" />;
                    })()}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" aria-hidden="true" />
                  </div>
                );
              })()}

              {/* Content — strict hierarchy: Brand → Context → Badges → Vibe */}
              <div className="px-[24px] pt-[20px] pb-[40px] flex flex-col">
                {/* Category pill */}
                <span className="inline-flex self-start rounded-full px-3 py-1 bg-surface-sunken text-ink-2 text-micro mb-[8px]">
                  {collectionName}
                </span>

                {/* 1. The Brand (Title) */}
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); }}
                    className="text-title text-ink-1 w-full border border-border rounded-lg px-2 py-1 outline-none focus:border-ink-3 transition-colors"
                  />
                ) : (
                  <div className="flex items-start gap-2">
                    <h2
                      className="text-title text-ink-1 flex-1"
                      style={{ margin: 0 }}
                    >
                      {pin.title}
                    </h2>
                    <button
                      type="button"
                      onClick={handleStartEditing}
                      className="mt-1 p-1 text-ink-3 hover:text-ink-1 active:opacity-60 transition-colors flex-shrink-0"
                      aria-label="Edit pin"
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  </div>
                )}

                {/* Social proof badge */}
                {pin.rating != null && pin.rating > 4.5 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-700 text-micro rounded-full mt-[6px] self-start">
                    🔥 Popular
                  </span>
                )}

                {/* 2. The Context (Location) */}
                {pin.address && (
                  <p className="text-body font-medium text-ink-2 mt-[4px]">
                    {pin.address}
                  </p>
                )}

                {/* Open/Closed chip + Opening hours collapsible */}
                {pin.openingHours && pin.openingHours.length > 0 && (
                  <div className="mt-[8px]">
                    {/* Open/Closed status chip */}
                    {(() => {
                      const openStatus = isOpenNow(pin.openingHours);
                      if (openStatus === null) return null;
                      return openStatus ? (
                        <span className="inline-flex items-center px-2.5 py-1 bg-success/10 text-success text-micro rounded-full">
                          Open now
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 bg-danger/10 text-danger text-micro rounded-full">
                          Closed
                        </span>
                      );
                    })()}

                    {/* Collapsible opening hours */}
                    <button
                      type="button"
                      onClick={() => setHoursExpanded((v) => !v)}
                      className="flex items-center gap-1 mt-[6px] text-caption text-ink-2 active:opacity-60 transition-opacity"
                      aria-expanded={hoursExpanded}
                      aria-label="Toggle opening hours"
                    >
                      <span>Opening hours</span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${hoursExpanded ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                    {hoursExpanded && (
                      <ul className="mt-[4px] space-y-[2px]">
                        {pin.openingHours.map((line, i) => (
                          <li key={i} className="text-caption text-ink-3">
                            {line}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* 3. Collection picker */}
                <div className="relative mt-[8px]">
                  <button
                    type="button"
                    onClick={() => setCollectionPickerOpen((v) => !v)}
                    className="flex items-center gap-2 px-3 py-1 bg-surface-raised rounded-lg text-caption text-ink-2 active:bg-surface-sunken transition-colors"
                  >
                    <FolderOpen size={14} aria-hidden="true" />
                    {currentCollection?.name ?? "Unorganized"}
                  </button>

                  {/* Collection dropdown */}
                  {collectionPickerOpen && (
                    <div className="absolute top-full left-0 mt-[6px] w-[220px] bg-white rounded-control shadow-elev-2 border border-surface-sunken z-30 py-[6px] overflow-visible">
                      <div className="rounded-b-lg overflow-hidden">
                      {collections.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleMoveToCollection(c.id)}
                          className="w-full flex items-center justify-between px-[14px] py-[10px] text-caption text-ink-1 hover:bg-surface-sunken transition-colors text-left"
                        >
                          <span className="truncate font-medium">{c.name}</span>
                          {pin.collectionId === c.id && (
                            <Check size={14} className="text-success flex-shrink-0 ml-2" aria-hidden="true" />
                          )}
                        </button>
                      ))}
                      </div>

                      {/* Inline collection creation */}
                      <div className="border-t border-surface-sunken mt-[2px] pt-[2px]">
                        {isCreatingCollection ? (
                          <div className="flex items-center gap-2 px-[14px] py-[8px]">
                            <input
                              type="text"
                              value={newCollectionName}
                              onChange={(e) => setNewCollectionName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreateCollection();
                              }}
                              placeholder="Collection name"
                              className="flex-1 min-w-0 text-caption px-2 py-1 border border-border rounded-lg outline-none focus:border-ink-3 transition-colors"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={handleCreateCollection}
                              className="text-micro text-white bg-black rounded-lg px-3 py-1 active:opacity-60 transition-opacity"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsCreatingCollection(true)}
                            className="w-full flex items-center gap-2 px-[14px] py-[10px] text-caption text-ink-1 hover:bg-surface-sunken transition-colors text-left"
                          >
                            <Plus size={14} className="flex-shrink-0" aria-hidden="true" />
                            <span className="font-medium">New Collection</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. The Badges — type + rating + price pills */}
                {(pin.primaryType || pin.rating != null || pin.priceLevel) && (
                  <div className="flex flex-wrap items-center gap-[8px] mt-[16px]">
                    {pin.primaryType && (
                      <span className="inline-flex items-center px-[10px] py-[5px] bg-surface-sunken text-ink-1 text-micro uppercase tracking-[0.6px] rounded-full">
                        {pin.primaryType.replace(/_/g, " ")}
                      </span>
                    )}
                    {pin.priceLevel != null && pin.priceLevel > 0 && (
                      <span className="inline-flex items-center px-[10px] py-[5px] bg-surface-sunken text-ink-2 text-micro rounded-full">
                        {"$".repeat(pin.priceLevel)}
                      </span>
                    )}
                    {pin.rating != null && (
                      <span className="inline-flex items-center gap-[3px] px-[10px] py-[5px] bg-warning/10 text-warning text-micro tracking-[0.4px] rounded-full">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        {pin.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                )}

                {/* 5. The Vibe (Description) — separated by subtle divider */}
                <div className="mt-[24px] mb-[24px] h-[1px] w-full bg-surface-sunken" />
                {isEditing ? (
                  <>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      placeholder="Add a description..."
                      className="text-caption leading-[22px] text-ink-2 w-full border border-border rounded-lg px-2 py-1 outline-none focus:border-ink-3 transition-colors resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="mt-3 h-11 w-full bg-ink-1 text-white text-body font-bold rounded-control flex items-center justify-center transition-all active:scale-[0.97] hover:bg-ink-1/90"
                    >
                      Save Changes
                    </button>
                  </>
                ) : pin.description ? (
                  <p className="text-caption text-ink-2 italic line-clamp-6">
                    {pin.description}
                  </p>
                ) : (
                  <p className="text-caption text-ink-2 italic">
                    Saved from{" "}
                    <span className="font-medium not-italic text-ink-2">
                      {new URL(pin.sourceUrl).hostname}
                    </span>
                  </p>
                )}

                {/* Affiliate section — Plan Your Visit */}
                {affiliateResult && (
                  <div className="mt-[20px]">
                    <h3 className="text-caption font-bold text-ink-1 uppercase tracking-[0.5px] mb-[10px]">
                      Plan Your Visit
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        window.open(affiliateResult.url, '_blank', 'noopener,noreferrer');
                        trackReferralClick({ pinId: pin!.id, platformName: affiliateResult.platformName });
                      }}
                      className="w-full h-12 rounded-control text-body font-bold text-white flex items-center justify-center transition-all active:scale-[0.97]"
                      style={{ backgroundColor: affiliateResult.bgColor }}
                    >
                      {affiliateResult.label}
                    </button>
                  </div>
                )}

                {/* Divider */}
                <div className="h-px bg-surface-sunken mt-[20px] mb-[16px]" />

                {/* Meta row — source + coordinates */}
                <div className="flex items-baseline justify-between">
                  <p className="text-micro text-ink-3">
                    via{" "}
                    <span className="font-medium text-ink-2">
                      {new URL(pin.sourceUrl).hostname}
                    </span>
                  </p>
                  <p className="text-micro text-border-strong font-mono">
                    {pin.latitude.toFixed(4)}°, {pin.longitude.toFixed(4)}°
                  </p>
                </div>

                {/* Remove Pin — destructive secondary action */}
                <button
                  type="button"
                  onClick={handleRemove}
                  className="mt-4 text-body font-semibold text-danger py-2 active:opacity-60 transition-opacity"
                >
                  Remove from Map
                </button>
              </div>
            </div>

            {/* Sticky bottom action row */}
            <div className="sticky bottom-0 bg-surface shadow-elev-2 px-[24px] py-[16px] flex gap-[12px]">
              <a
                href={pin.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-12 bg-ink-1 text-white text-body font-bold rounded-pill flex items-center justify-center gap-[8px] transition-all active:scale-[0.97] hover:bg-ink-1/90"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                View Source
              </a>
              <a
                href={getGoogleMapsPlaceUrl(pin)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent(EVENTS.DIRECTIONS_OPENED, { pin_id: pin.id })}
                className="flex-1 h-12 bg-white text-black border border-border text-body font-bold rounded-pill flex items-center justify-center gap-[8px] transition-all active:scale-[0.97] hover:bg-surface-raised"
              >
                Open in Google Maps
              </a>
            </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
