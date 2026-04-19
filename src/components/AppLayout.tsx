'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { DndContext, DragOverlay, rectIntersection } from '@dnd-kit/core';
import MapView from '@/components/MapView';
import MagicBar from '@/components/MagicBar';
import BottomNav from '@/components/BottomNav';
import PlaceSheet from '@/components/PlaceSheet';
import ProfileSheet from '@/components/ProfileSheet';
import DiscoverFeed from '@/components/DiscoverFeed';
import CollectionDrawer from '@/components/CollectionDrawer';
import PlannerSidebar from '@/components/PlannerSidebar';
import useCloudSync from '@/hooks/useCloudSync';
import usePlannerDnd from '@/hooks/usePlannerDnd';
import useTravelPinStore from '@/store/useTravelPinStore';
import usePlannerStore from '@/store/usePlannerStore';
import type { MapViewRef } from '@/components/MapView';
import type { MagicBarRef } from '@/components/MagicBar';

export default function AppLayout() {
  useCloudSync();
  const mapViewRef = useRef<MapViewRef>(null);
  const magicBarRef = useRef<MagicBarRef>(null);

  const [activeTab, setActiveTab] = useState<'discover' | 'add' | 'plan' | 'profile'>('add');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDiscoverOpen, setIsDiscoverOpen] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [isCollectionDrawerOpen, setIsCollectionDrawerOpen] = useState(false);
  const itinerariesLoadedRef = useRef(false);

  const fetchItineraries = usePlannerStore((s) => s.fetchItineraries);
  const { sensors, activeDrag, handleDragStart, handleDragEnd, DragPreview } =
    usePlannerDnd();

  const activePinId = useTravelPinStore((s) => s.activePinId);
  const pins = useTravelPinStore((s) => s.pins);
  const setActivePinId = useTravelPinStore((s) => s.setActivePinId);

  const activePin = pins.find((p) => p.id === activePinId) ?? null;

  const handleTabChange = useCallback(
    (tab: 'discover' | 'add' | 'plan' | 'profile') => {
      if (tab === 'plan') {
        if (isPlannerOpen) {
          // Toggle OFF
          setIsPlannerOpen(false);
          setActiveTab('add');
        } else {
          // Toggle ON
          setIsPlannerOpen(true);
          setIsProfileOpen(false);
          setIsDiscoverOpen(false);
          setActiveTab('plan');
          if (!itinerariesLoadedRef.current) {
            itinerariesLoadedRef.current = true;
            fetchItineraries();
          }
        }
        return;
      }

      // Close planner when switching to another overlay
      if (isPlannerOpen) {
        setIsPlannerOpen(false);
      }

      setActiveTab(tab);

      if (tab === 'profile') {
        setIsProfileOpen(true);
        setIsDiscoverOpen(false);
      } else if (tab === 'discover') {
        setIsDiscoverOpen(true);
        setIsProfileOpen(false);
      } else {
        // 'add' tab — close sheets, focus MagicBar
        setIsProfileOpen(false);
        setIsDiscoverOpen(false);
        magicBarRef.current?.focus();
      }
    },
    [isPlannerOpen, fetchItineraries],
  );

  const handlePlaceSheetDismiss = useCallback(() => {
    setActivePinId(null);
  }, [setActivePinId]);

  const handleProfileOpenChange = useCallback((open: boolean) => {
    setIsProfileOpen(open);
    if (!open) setActiveTab('add');
  }, []);

  const handleDiscoverOpenChange = useCallback((open: boolean) => {
    setIsDiscoverOpen(open);
    if (!open) setActiveTab('add');
  }, []);

  // Resize MapView after planner sidebar transition completes on desktop
  useEffect(() => {
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (!isDesktop) return;

    const timeout = setTimeout(() => {
      mapViewRef.current?.resize();
    }, 300);

    return () => clearTimeout(timeout);
  }, [isPlannerOpen]);

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden overscroll-none touch-none bg-[#FAFAFA]">
      {/* z-0: Map background — always mounted, full-screen */}
      <MapView ref={mapViewRef} className="absolute inset-0 z-0" />

      {/* CollectionDrawer + PlannerSidebar wrapped in DndContext when planner is open */}
      {isPlannerOpen ? (
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <CollectionDrawer
            isOpen={isCollectionDrawerOpen}
            onToggle={() => setIsCollectionDrawerOpen((v) => !v)}
          />
          <PlannerSidebar
            isOpen={isPlannerOpen}
            onClose={() => setIsPlannerOpen(false)}
          />
          <DragOverlay dropAnimation={null}>
            {activeDrag ? <DragPreview data={activeDrag} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <CollectionDrawer
          isOpen={isCollectionDrawerOpen}
          onToggle={() => setIsCollectionDrawerOpen((v) => !v)}
        />
      )}

      {/* z-30: Bottom navigation pill */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* z-40: Floating search bar */}
      <MagicBar ref={magicBarRef} />

      {/* z-50: Place detail bottom sheet */}
      <PlaceSheet pin={activePin} onDismiss={handlePlaceSheetDismiss} />

      {/* z-50: Profile sheet — auth + collections */}
      <ProfileSheet open={isProfileOpen} onOpenChange={handleProfileOpenChange} />

      {/* z-50: Discover feed — pin image grid */}
      <DiscoverFeed open={isDiscoverOpen} onOpenChange={handleDiscoverOpenChange} />
    </div>
  );
}
