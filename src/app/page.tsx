'use client';

import { useRef } from 'react';
import MapView from '@/components/MapView';
import MagicBar from '@/components/MagicBar';
import CollectionDrawer from '@/components/CollectionDrawer';
import useTravelPinStore from '@/store/useTravelPinStore';
import type { MapViewRef } from '@/components/MapView';

export default function Home() {
  const isDrawerOpen = useTravelPinStore((s) => s.isDrawerOpen);
  const toggleDrawer = useTravelPinStore((s) => s.toggleDrawer);
  const mapViewRef = useRef<MapViewRef>(null);

  return (
    <div className="relative w-screen h-screen h-[100dvh] overflow-hidden">
      {/* Collection Drawer */}
      <CollectionDrawer isOpen={isDrawerOpen} onToggle={toggleDrawer} />

      {/* MagicBar floating input */}
      <MagicBar />

      {/* Map container — shifts right on desktop (≥768px) when drawer is open.
          On mobile the drawer is a bottom-sheet overlay so the map stays full-width. */}
      <div
        className={[
          'absolute inset-0 left-0 transition-[left] duration-300 ease-in-out',
          isDrawerOpen ? 'md:left-[360px]' : 'md:left-0',
        ].join(' ')}
        onTransitionEnd={() => {
          mapViewRef.current?.resize();
        }}
      >
        <MapView ref={mapViewRef} />
      </div>
    </div>
  );
}
