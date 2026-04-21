"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import { MapPin, Copy, Loader2 } from "lucide-react";
import type { Itinerary, PlannedPin } from "@/types";
import usePlannerStore from "@/store/usePlannerStore";
import { createClient } from "@/utils/supabase/client";
import AuthModal from "@/components/AuthModal";

const TILE_STYLE = "https://tiles.stadiamaps.com/styles/alidade_smooth.json";

/** Layers to hide so only user-created markers are visible */
const POI_LAYER_FILTERS = ["poi", "label", "icon", "place", "text"];

function shouldHideLayer(layerId: string): boolean {
  const id = layerId.toLowerCase();
  return POI_LAYER_FILTERS.some((keyword) => id.includes(keyword));
}

/**
 * Group planned pins by day_number and sort by sort_order within each group.
 * Exported for testability (Property 1).
 */
export function groupAndSortPins(
  pins: PlannedPin[]
): { dayNumber: number; pins: PlannedPin[] }[] {
  const grouped = new Map<number, PlannedPin[]>();
  for (const pin of pins) {
    const list = grouped.get(pin.day_number) ?? [];
    list.push(pin);
    grouped.set(pin.day_number, list);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([dayNumber, dayPins]) => ({
      dayNumber,
      pins: dayPins.slice().sort((a, b) => a.sort_order - b.sort_order),
    }));
}

interface PublicTripViewProps {
  itinerary: Itinerary;
  plannedPins: PlannedPin[];
}

export default function PublicTripView({
  itinerary,
  plannedPins,
}: PublicTripViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const days = useMemo(() => groupAndSortPins(plannedPins), [plannedPins]);

  const router = useRouter();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [cloning, setCloning] = useState(false);

  const handleCloneClick = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    setCloning(true);
    try {
      const newId = await usePlannerStore.getState().cloneItinerary(itinerary.id);
      if (newId) {
        router.push("/");
      }
    } finally {
      setCloning(false);
    }
  }, [itinerary.id, router]);

  // Initialize map and add markers
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Compute bounds from pins for initial view
    const hasCoords = plannedPins.length > 0;
    const defaultCenter: [number, number] = hasCoords
      ? [plannedPins[0].longitude, plannedPins[0].latitude]
      : [0, 20];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: TILE_STYLE,
      center: defaultCenter,
      zoom: hasCoords ? 10 : 2,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });

    // Disable rotation but keep pan/zoom
    map.dragRotate.disable();
    map.keyboard.disable();
    map.touchPitch.disable();

    map.on("style.load", () => {
      const style = map.getStyle();
      if (!style?.layers) return;
      for (const layer of style.layers) {
        if (shouldHideLayer(layer.id)) {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      }
    });

    // Add markers for all pins
    map.on("load", () => {
      for (const pin of plannedPins) {
        const el = document.createElement("div");
        el.style.width = "40px";
        el.style.height = "40px";
        el.style.borderRadius = "50%";
        el.style.border = "2.5px solid #FFFFFF";
        el.style.boxShadow = "0 4px 8px rgba(0,0,0,0.15)";
        el.style.overflow = "hidden";
        el.style.backgroundColor = "#6366F1";
        el.style.cursor = "default";

        if (pin.imageUrl) {
          const img = document.createElement("img");
          img.src = pin.imageUrl;
          img.alt = pin.title || "Pin";
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "cover";
          img.style.borderRadius = "50%";
          img.style.display = "block";
          img.style.pointerEvents = "none";
          img.onerror = () => {
            el.removeChild(img);
            el.style.display = "flex";
            el.style.alignItems = "center";
            el.style.justifyContent = "center";
            el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`;
          };
          el.appendChild(img);
        } else {
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`;
        }

        new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([pin.longitude, pin.latitude])
          .addTo(map);
      }

      // Fit bounds to show all markers
      if (plannedPins.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        for (const pin of plannedPins) {
          bounds.extend([pin.longitude, pin.latitude]);
        }
        map.fitBounds(bounds, { padding: 80, maxZoom: 14 });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [plannedPins]);

  const formattedDate = itinerary.tripDate
    ? new Date(itinerary.tripDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Full-screen map */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: "#FAFAFA" }}
      />

      {/* Timeline Overlay */}
      <div className="absolute top-0 left-0 bottom-0 w-[360px] max-w-[85vw] bg-white/95 backdrop-blur-sm shadow-xl overflow-y-auto z-10">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-5 pt-6 pb-4 z-20">
          <h1 className="text-[22px] font-extrabold tracking-[-0.5px] text-[#111111] leading-tight">
            {itinerary.name}
          </h1>
          {formattedDate && (
            <p className="text-[13px] text-neutral-500 mt-1">{formattedDate}</p>
          )}
        </div>

        {/* Day groups */}
        <div className="px-5 py-4 space-y-6">
          {days.length === 0 ? (
            <p className="text-[13px] text-neutral-400 text-center py-12">
              No pins in this trip yet
            </p>
          ) : (
            days.map(({ dayNumber, pins: dayPins }) => (
              <div key={dayNumber}>
                <h3 className="text-[18px] font-extrabold tracking-[-0.3px] text-[#111111] mb-3">
                  Day {dayNumber}
                </h3>
                <div className="flex flex-col gap-2">
                  {dayPins.map((pin) => (
                    <div
                      key={pin.itinerary_item_id}
                      className="flex items-center gap-3 rounded-lg bg-white border border-gray-200 p-2"
                    >
                      <div className="w-14 h-14 rounded-lg bg-neutral-100 overflow-hidden shrink-0">
                        {pin.imageUrl ? (
                          <img
                            src={pin.imageUrl}
                            alt={pin.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-300">
                            <MapPin className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold tracking-tight text-[#111111] truncate">
                          {pin.title}
                        </p>
                        {pin.address && (
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {pin.address}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Clone button */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-5 py-4 z-20">
          <button
            onClick={handleCloneClick}
            disabled={cloning}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#6366F1] text-white font-bold text-[14px] tracking-tight hover:bg-[#5558E6] active:scale-[0.98] transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {cloning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {cloning ? "Copying…" : "Copy this Trip to my Yupp"}
          </button>
        </div>
      </div>

      {/* Auth Modal for unauthenticated users */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        message="Log in to save and plan your own trips."
      />
    </div>
  );
}
