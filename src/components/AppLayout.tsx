'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { DndContext, DragOverlay, rectIntersection } from '@dnd-kit/core';
import MapView from '@/components/MapView';
import MagicBar from '@/components/MagicBar';
import BottomNav from '@/components/BottomNav';
import PlaceSheet from '@/components/PlaceSheet';
import ProfileSheet from '@/components/ProfileSheet';
import DiscoverFeed from '@/components/DiscoverFeed';
import CollectionDrawer from '@/components/CollectionDrawer';
import PlannerSidebar from '@/components/PlannerSidebar';
import AuthModal from '@/components/AuthModal';
import PinImage from '@/components/PinImage';
import EmptyState from '@/components/empty-states/EmptyState';
import MapIllustration from '@/components/empty-states/illustrations/MapIllustration';
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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState<string | undefined>(undefined);
  const autoPasteProcessedRef = useRef(false);
  const { sensors, activeDrag, handleDragStart, handleDragEnd, DragPreview } =
    usePlannerDnd({
      onDragStart: () => mapViewRef.current?.disableInteractions(),
      onDragEnd: () => mapViewRef.current?.enableInteractions(),
    });

  const activePinId = useTravelPinStore((s) => s.activePinId);
  const pins = useTravelPinStore((s) => s.pins);
  const setActivePinId = useTravelPinStore((s) => s.setActivePinId);

  const itineraries = usePlannerStore((s) => s.itineraries);
  const loadItinerary = usePlannerStore((s) => s.loadItinerary);

  const activePin = pins.find((p) => p.id === activePinId) ?? null;

  // Recent pins: 12 most recent by createdAt descending
  const recentPins = useMemo(
    () =>
      [...pins]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 12),
    [pins],
  );

  // Hide home surface strips when any vaul drawer is open
  const isAnyDrawerOpen = isProfileOpen || isDiscoverOpen || isPlannerOpen || !!activePinId;

  const handleTripCardTap = useCallback(
    async (itineraryId: string) => {
      await loadItinerary(itineraryId);
      setIsPlannerOpen(true);
      setIsProfileOpen(false);
      setIsDiscoverOpen(false);
      setActiveTab('plan');
    },
    [loadItinerary],
  );

  const handleRecentPinTap = useCallback(
    (pinId: string) => {
      setActivePinId(pinId);
    },
    [setActivePinId],
  );

  const handleTabChange = useCallback(
    (tab: 'discover' | 'add' | 'plan' | 'profile') => {
      if (tab === 'plan') {
        // Login gateway: check auth before opening planner
        const user = useTravelPinStore.getState().user;
        if (!user || user.is_anonymous) {
          setAuthModalMessage('Log in to save and plan your own trips.');
          setIsAuthModalOpen(true);
          return;
        }

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
    [isPlannerOpen],
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

  // Consume autoPaste query parameter on mount (from /share redirect)
  useEffect(() => {
    if (autoPasteProcessedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const autoPasteUrl = params.get('autoPaste');
    if (!autoPasteUrl) return;

    autoPasteProcessedRef.current = true;

    // Remove autoPaste param from browser URL without page reload
    params.delete('autoPaste');
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
    window.history.replaceState({}, '', newUrl);

    // Trigger MagicBar processing with the shared URL
    magicBarRef.current?.triggerProcess(autoPasteUrl);
  }, []);

  return (
    <div className="relative w-screen h-screen h-[100dvh] overflow-hidden overscroll-none bg-[#FAFAFA]">
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* z-0: Map background — always mounted, full-screen */}
        <MapView ref={mapViewRef} className="absolute inset-0 z-0" />

        {/* CollectionDrawer — not a drag source */}
        <CollectionDrawer
          isOpen={isCollectionDrawerOpen}
          onToggle={() => setIsCollectionDrawerOpen((v) => !v)}
        />

        {/* PlannerSidebar — conditionally rendered */}
        {isPlannerOpen && (
          <PlannerSidebar
            isOpen={isPlannerOpen}
            onClose={() => setIsPlannerOpen(false)}
            mapViewRef={mapViewRef}
          />
        )}

        {/* Home Surface — Trip Cards + Recent Pins strips */}
        {!isAnyDrawerOpen && (itineraries.length > 0 || recentPins.length > 0) && (
          <div className="absolute bottom-24 left-0 right-0 z-10 flex flex-col gap-3 pointer-events-none">
            {/* Trip Cards strip */}
            {itineraries.length > 0 && (
              <div className="pointer-events-auto">
                <h2 className="px-4 pb-1 text-caption text-ink-2">My Trips</h2>
                <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
                  {itineraries.map((itinerary) => (
                    <button
                      key={itinerary.id}
                      onClick={() => handleTripCardTap(itinerary.id)}
                      className="flex-shrink-0 w-40 rounded-card bg-surface shadow-elev-1 overflow-hidden text-left transition-shadow hover:shadow-elev-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
                      aria-label={`Open trip ${itinerary.name}`}
                    >
                      <div className="h-20 bg-surface-sunken flex items-center justify-center">
                        <span className="text-ink-3 text-micro uppercase tracking-wider">Trip</span>
                      </div>
                      <div className="p-2">
                        <p className="text-caption text-ink-1 truncate font-semibold">{itinerary.name}</p>
                        {itinerary.tripDate && (
                          <p className="text-micro text-ink-3 mt-0.5">
                            {new Date(itinerary.tripDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Pins strip */}
            {recentPins.length > 0 && (
              <div className="pointer-events-auto">
                <h2 className="px-4 pb-1 text-caption text-ink-2">Recent Pins</h2>
                <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
                  {recentPins.map((pin) => (
                    <button
                      key={pin.id}
                      onClick={() => handleRecentPinTap(pin.id)}
                      className="flex-shrink-0 w-[88px] h-[88px] rounded-chip overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
                      aria-label={`View ${pin.title}`}
                    >
                      <PinImage
                        src={pin.imageUrl}
                        alt={pin.title}
                        pinId={pin.id}
                        aspectRatio="1/1"
                        className="w-full h-full rounded-chip"
                        sizes="88px"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Home Surface — Empty state when no pins and no itineraries */}
        {!isAnyDrawerOpen && pins.length === 0 && itineraries.length === 0 && (
          <div className="absolute bottom-24 left-0 right-0 z-10 pointer-events-auto">
            <EmptyState
              illustration={<MapIllustration />}
              message="Paste a link to pin your first place"
              ctaLabel="Get Started"
              onCtaClick={() => magicBarRef.current?.focus()}
            />
          </div>
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

        {/* Auth modal for login gateway */}
        <AuthModal
          open={isAuthModalOpen}
          onOpenChange={setIsAuthModalOpen}
          message={authModalMessage}
        />

        <DragOverlay dropAnimation={null} zIndex={85}>
          {activeDrag ? <DragPreview data={activeDrag} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
