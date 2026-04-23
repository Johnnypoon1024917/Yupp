'use client';

import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import maplibregl from 'maplibre-gl';
import useTravelPinStore from '@/store/useTravelPinStore';
import usePlannerStore from '@/store/usePlannerStore';
import { useHydrated } from '@/hooks/useHydrated';
import { createVisualMarkerElement } from '@/components/VisualMarker';
import type { Pin } from '@/types';

export interface MapViewRef {
  flyToPin: (lat: number, lng: number) => void;
  resize: () => void;
  disableInteractions: () => void;
  enableInteractions: () => void;
}

const TILE_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

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

  // Track global pointer position for MapLibre drop detection
  const pointerPosRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const updatePos = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e && e.touches.length > 0) {
        pointerPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if ('clientX' in e) {
        pointerPosRef.current = { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
      }
    };
    window.addEventListener('mousemove', updatePos);
    window.addEventListener('touchmove', updatePos);
    return () => {
      window.removeEventListener('mousemove', updatePos);
      window.removeEventListener('touchmove', updatePos);
    };
  }, []);

  /**
   * Add a draggable marker to the map for the given pin.
   * Enables MapLibre native drag → detects drop over sidebar DayContainers → bridges to Zustand store.
   */
  const addMarkerForPin = useCallback((pin: Pin) => {
    const map = mapRef.current;
    if (!map || markersRef.current.has(pin.id)) return;

    let wasDragged = false;

    const element = createVisualMarkerElement({
      pin,
      onClick: (clickedPin) => {
        if (wasDragged) return; // Skip flyTo if this was a drag-and-drop
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

    // Make marker draggable via MapLibre native drag
    const marker = new maplibregl.Marker({ element, anchor: 'center', draggable: true })
      .setLngLat([pin.longitude, pin.latitude])
      .addTo(map);

    // Visual lift effect on drag start — clone marker to body for z-index escape
    let dragClone: HTMLElement | null = null;
    let hoveredDay: HTMLElement | null = null;

    marker.on('dragstart', () => {
      wasDragged = true;
      // Hide the original marker element during drag
      element.style.opacity = '0.3';

      // Create a floating clone at body level so it renders above the sidebar
      dragClone = element.cloneNode(true) as HTMLElement;
      dragClone.style.position = 'fixed';
      dragClone.style.pointerEvents = 'none';
      dragClone.style.zIndex = '10000';
      dragClone.style.cursor = 'grabbing';
      dragClone.style.filter = 'drop-shadow(0 8px 16px rgba(0,0,0,0.25))';
      const rect = element.getBoundingClientRect();
      dragClone.style.left = `${rect.left}px`;
      dragClone.style.top = `${rect.top}px`;
      dragClone.style.width = `${rect.width}px`;
      dragClone.style.height = `${rect.height}px`;
      dragClone.style.opacity = '1';
      // Hop animation: bounce up then settle at lifted scale
      dragClone.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      dragClone.style.transform = 'scale(1) translateY(0)';
      document.body.appendChild(dragClone);
      // Trigger the hop on next frame
      requestAnimationFrame(() => {
        if (dragClone) {
          dragClone.style.transform = 'scale(1.2) translateY(-12px)';
        }
      });

      // Let the pointer pass through the sidebar so drag tracking continues
      document.querySelectorAll('[data-planner-sidebar]').forEach((el) => {
        (el as HTMLElement).style.pointerEvents = 'none';
      });
    });

    // Track clone position during drag + highlight day containers on hover
    const updateClonePos = () => {
      if (dragClone) {
        const rect = element.getBoundingClientRect();
        dragClone.style.left = `${rect.left}px`;
        dragClone.style.top = `${rect.top}px`;
        // After initial hop, use instant positioning
        dragClone.style.transition = 'none';
      }

      // Live hover highlight on day containers
      const { x, y } = pointerPosRef.current;
      // Temporarily re-enable sidebar pointer events for hit-testing
      document.querySelectorAll('[data-planner-sidebar]').forEach((el) => {
        (el as HTMLElement).style.pointerEvents = '';
      });
      const hitElements = document.elementsFromPoint(x, y);
      document.querySelectorAll('[data-planner-sidebar]').forEach((el) => {
        (el as HTMLElement).style.pointerEvents = 'none';
      });

      let foundDay: HTMLElement | null = null;
      for (const el of hitElements) {
        if (el.hasAttribute('data-droppable-day')) {
          foundDay = el as HTMLElement;
          break;
        }
      }

      if (foundDay !== hoveredDay) {
        // Remove highlight from previous
        if (hoveredDay) {
          hoveredDay.style.borderColor = '';
          hoveredDay.style.backgroundColor = '';
          hoveredDay.style.boxShadow = '';
        }
        // Add highlight to new
        if (foundDay) {
          foundDay.style.borderColor = '#6366f1';
          foundDay.style.backgroundColor = 'rgba(99, 102, 241, 0.06)';
          foundDay.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.2)';
        }
        hoveredDay = foundDay;
      }
    };
    marker.on('drag', updateClonePos);

    // Drop bridge: remove clone, snap marker back, check if dropped over a DayContainer
    marker.on('dragend', () => {
      // Clear any hover highlight
      if (hoveredDay) {
        hoveredDay.style.borderColor = '';
        hoveredDay.style.backgroundColor = '';
        hoveredDay.style.boxShadow = '';
        hoveredDay = null;
      }

      // Remove the floating clone
      if (dragClone) {
        dragClone.remove();
        dragClone = null;
      }
      element.style.opacity = '';

      // Re-enable sidebar pointer events BEFORE hit-testing
      document.querySelectorAll('[data-planner-sidebar]').forEach((el) => {
        (el as HTMLElement).style.pointerEvents = '';
      });

      marker.setLngLat([pin.longitude, pin.latitude]);
      setTimeout(() => { wasDragged = false; }, 100);

      // Hit-test the pointer position against sidebar DayContainers
      const { x, y } = pointerPosRef.current;
      const elements = document.elementsFromPoint(x, y);
      for (const el of elements) {
        const dayAttr = el.getAttribute('data-droppable-day');
        if (dayAttr) {
          const dayNumber = parseInt(dayAttr, 10);
          usePlannerStore.getState().addPinToDay(pin, dayNumber);
          break;
        }
      }
    });

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

  /** Disable all map interactions (pan, zoom, rotate, keyboard) */
  const disableInteractions = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.dragPan.disable();
    map.scrollZoom.disable();
    map.boxZoom.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
    map.touchPitch.disable();
  }, []);

  /** Re-enable all map interactions */
  const enableInteractions = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.dragPan.enable();
    map.scrollZoom.enable();
    map.boxZoom.enable();
    map.dragRotate.enable();
    map.keyboard.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
    map.touchPitch.enable();
  }, []);

  // Expose flyToPin, resize, and interaction controls via ref
  useImperativeHandle(ref, () => ({ flyToPin, resize, disableInteractions, enableInteractions }), [flyToPin, resize, disableInteractions, enableInteractions]);

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
    setTimeout(() => map.resize(), 100);

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
        touchAction: 'none',
      }}
    />
  );
});

export default MapView;
