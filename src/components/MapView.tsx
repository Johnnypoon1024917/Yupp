'use client';

import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import maplibregl from 'maplibre-gl';
import useTravelPinStore from '@/store/useTravelPinStore';
import { useHydrated } from '@/hooks/useHydrated';
import { createVisualMarkerElement } from '@/components/VisualMarker';
import type { Pin } from '@/types';

export interface MapViewRef {
  flyToPin: (lat: number, lng: number) => void;
  resize: () => void;
}

const TILE_STYLE = 'https://tiles.stadiamaps.com/styles/alidade_smooth.json';

/** Layers to hide so only user-created markers are visible */
const POI_LAYER_FILTERS = ['poi', 'label', 'icon', 'place', 'text'];

function shouldHideLayer(layerId: string): boolean {
  const id = layerId.toLowerCase();
  return POI_LAYER_FILTERS.some((keyword) => id.includes(keyword));
}

interface MapViewProps {
  className?: string;
}

const MapView = forwardRef<MapViewRef, MapViewProps>(function MapView({ className }, ref) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const prevPinCountRef = useRef<number>(0);
  /** Pin IDs whose markers are deferred until after flyTo completes */
  const pendingMarkerPinIdsRef = useRef<Set<string>>(new Set());

  const pins = useHydrated(() => useTravelPinStore.getState().pins, []);

  /**
   * Add a single marker to the map for the given pin.
   * Extracted so it can be called both during normal sync and after flyTo.
   */
  const addMarkerForPin = useCallback((pin: Pin) => {
    const map = mapRef.current;
    if (!map || markersRef.current.has(pin.id)) return;

    const element = createVisualMarkerElement({
      pin,
      onClick: (clickedPin) => {
        if (map) {
          map.flyTo({
            center: [clickedPin.longitude, clickedPin.latitude],
            pitch: 45,
            zoom: 12,
            speed: 1.2,
          });
          map.once('moveend', () => {
            map.easeTo({ pitch: 0, duration: 1000 });
          });
          useTravelPinStore.getState().setActivePinId(clickedPin.id);
        }
      },
    });

    const marker = new maplibregl.Marker({ element, anchor: 'center' })
      .setLngLat([pin.longitude, pin.latitude])
      .addTo(map);

    markersRef.current.set(pin.id, marker);
  }, []);

  /** Fly the camera to a pin location with cinematic pitch tilt */
  const flyToPin = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;

    map.flyTo({
      center: [lng, lat],
      pitch: 45,
      zoom: 12,
      speed: 1.2,
    });

    // After the fly animation completes, render pending markers then ease pitch back to 0
    map.once('moveend', () => {
      // Render any markers that were deferred until flyTo completed
      const currentPins = useTravelPinStore.getState().pins;
      pendingMarkerPinIdsRef.current.forEach((pinId) => {
        const pin = currentPins.find((p) => p.id === pinId);
        if (pin) {
          addMarkerForPin(pin);
        }
      });
      pendingMarkerPinIdsRef.current.clear();

      map.easeTo({ pitch: 0, duration: 1000 });
    });
  }, [addMarkerForPin]);

  /** Tell MapLibre to recalculate its container size (e.g., after a CSS transition) */
  const resize = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  // Expose flyToPin and resize via ref for external use
  useImperativeHandle(ref, () => ({ flyToPin, resize }), [flyToPin, resize]);

  // Initialize the map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: TILE_STYLE,
      center: [0, 20],
      zoom: 2,
      pitchWithRotate: true,
      dragRotate: true,
    });

    // Suppress POI icons and labels once the style loads
    map.on('style.load', () => {
      const style = map.getStyle();
      if (!style?.layers) return;

      for (const layer of style.layers) {
        if (shouldHideLayer(layer.id)) {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
        }
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers with pins from the store
  const syncMarkers = useCallback(
    (currentPins: Pin[]) => {
      const map = mapRef.current;
      if (!map) return;

      const currentPinIds = new Set(currentPins.map((p) => p.id));

      // Remove markers for pins that no longer exist
      markersRef.current.forEach((marker, id) => {
        if (!currentPinIds.has(id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      });

      // Add markers for new pins (skip those deferred until flyTo completes)
      for (const pin of currentPins) {
        if (!markersRef.current.has(pin.id) && !pendingMarkerPinIdsRef.current.has(pin.id)) {
          addMarkerForPin(pin);
        }
      }
    },
    [addMarkerForPin],
  );

  // React to pin changes
  useEffect(() => {
    syncMarkers(pins);
  }, [pins, syncMarkers]);

  // Subscribe to store changes so markers update even outside React renders
  useEffect(() => {
    const unsubscribe = useTravelPinStore.subscribe((state) => {
      syncMarkers(state.pins);
    });
    return unsubscribe;
  }, [syncMarkers]);

  // Detect new pin additions and trigger cinematic flyTo
  useEffect(() => {
    const prevCount = prevPinCountRef.current;
    const currentCount = pins.length;

    if (currentCount > prevCount) {
      // A new pin was added — defer its marker and fly to its coordinates
      const lastPin = pins[currentCount - 1];
      pendingMarkerPinIdsRef.current.add(lastPin.id);
      flyToPin(lastPin.latitude, lastPin.longitude);
    }

    prevPinCountRef.current = currentCount;
  }, [pins, flyToPin]);

  return (
    <div
      ref={mapContainerRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        background: '#FAFAFA',
      }}
    />
  );
});

export default MapView;
