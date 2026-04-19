'use client';

import { useRef, useState, useCallback } from 'react';
import MapView from '@/components/MapView';
import MagicBar from '@/components/MagicBar';
import BottomNav from '@/components/BottomNav';
import PlaceSheet from '@/components/PlaceSheet';
import AuthModal from '@/components/AuthModal';
import useCloudSync from '@/hooks/useCloudSync';
import useTravelPinStore from '@/store/useTravelPinStore';
import type { MapViewRef } from '@/components/MapView';
import type { MagicBarRef } from '@/components/MagicBar';

export default function AppLayout() {
  useCloudSync();
  const mapViewRef = useRef<MapViewRef>(null);
  const magicBarRef = useRef<MagicBarRef>(null);

  const [activeTab, setActiveTab] = useState<'discover' | 'add' | 'profile'>('discover');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const activePinId = useTravelPinStore((s) => s.activePinId);
  const pins = useTravelPinStore((s) => s.pins);
  const setActivePinId = useTravelPinStore((s) => s.setActivePinId);

  const activePin = pins.find((p) => p.id === activePinId) ?? null;

  const handleTabChange = useCallback(
    (tab: 'discover' | 'add' | 'profile') => {
      if (tab === 'profile') {
        setIsAuthModalOpen(true);
        return;
      }
      setActiveTab(tab);
      if (tab === 'add') {
        magicBarRef.current?.focus();
      }
    },
    [],
  );

  const handlePlaceSheetDismiss = useCallback(() => {
    setActivePinId(null);
  }, [setActivePinId]);

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden">
      {/* z-0: Map background — always mounted, full-screen */}
      <MapView ref={mapViewRef} className="absolute inset-0 z-0" />

      {/* z-30: Bottom navigation pill */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* z-40: Floating search bar */}
      <MagicBar ref={magicBarRef} />

      {/* z-50: Place detail bottom sheet */}
      <PlaceSheet pin={activePin} onDismiss={handlePlaceSheetDismiss} />

      {/* Auth modal — opened via Profile tab */}
      <AuthModal open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} />
    </div>
  );
}
