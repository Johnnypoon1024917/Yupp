'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MapView from '@/components/MapView';
import MagicBar from '@/components/MagicBar';
import BottomNav from '@/components/BottomNav';
import PlaceSheet from '@/components/PlaceSheet';
import ProfileSheet from '@/components/ProfileSheet';
import DiscoverFeed from '@/components/DiscoverFeed';
import useCloudSync from '@/hooks/useCloudSync';
import useTravelPinStore from '@/store/useTravelPinStore';
import type { MapViewRef } from '@/components/MapView';
import type { MagicBarRef } from '@/components/MagicBar';

export default function AppLayout() {
  useCloudSync();
  const router = useRouter();
  const mapViewRef = useRef<MapViewRef>(null);
  const magicBarRef = useRef<MagicBarRef>(null);

  const [activeTab, setActiveTab] = useState<'discover' | 'add' | 'plan' | 'profile'>('add');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDiscoverOpen, setIsDiscoverOpen] = useState(false);

  const activePinId = useTravelPinStore((s) => s.activePinId);
  const pins = useTravelPinStore((s) => s.pins);
  const setActivePinId = useTravelPinStore((s) => s.setActivePinId);

  const activePin = pins.find((p) => p.id === activePinId) ?? null;

  const handleTabChange = useCallback(
    (tab: 'discover' | 'add' | 'plan' | 'profile') => {
      setActiveTab(tab);

      if (tab === 'profile') {
        setIsProfileOpen(true);
        setIsDiscoverOpen(false);
      } else if (tab === 'discover') {
        setIsDiscoverOpen(true);
        setIsProfileOpen(false);
      } else if (tab === 'plan') {
        setIsProfileOpen(false);
        setIsDiscoverOpen(false);
        router.push('/planner');
      } else {
        // 'add' tab — close sheets, focus MagicBar
        setIsProfileOpen(false);
        setIsDiscoverOpen(false);
        magicBarRef.current?.focus();
      }
    },
    [],
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

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden overscroll-none touch-none bg-[#FAFAFA]">
      {/* z-0: Map background — always mounted, full-screen */}
      <MapView ref={mapViewRef} className="absolute inset-0 z-0" />

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
