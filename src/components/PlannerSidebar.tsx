'use client';

import { useEffect, useState, type RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from 'vaul';
import { ChevronDown, ChevronUp } from 'lucide-react';
import ItineraryToolbar from '@/components/planner/ItineraryToolbar';
import TripTimeline from '@/components/planner/TripTimeline';
import LibraryPane from '@/components/planner/LibraryPane';
import type { MapViewRef } from '@/components/MapView';

export interface PlannerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  mapViewRef?: RefObject<MapViewRef | null>;
}

/** Shared planner content — rendered inside both desktop panel and mobile drawer. */
function PlannerContent() {
  const [libOpen, setLibOpen] = useState(true);

  return (
    <>
      <ItineraryToolbar />
      {/* Collapsible saved-pins library (drag source) */}
      <button
        onClick={() => setLibOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-2.5 bg-white border-b border-gray-200 text-[13px] font-bold tracking-tight text-[#111111]"
      >
        <span>Saved Library</span>
        {libOpen ? (
          <ChevronUp className="w-4 h-4 text-neutral-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-neutral-400" />
        )}
      </button>
      {libOpen && (
        <LibraryPane className="max-h-[40vh] border-b border-gray-200 bg-white flex flex-col shrink-0" />
      )}
      <TripTimeline className="flex-1 overflow-y-auto p-4" />
    </>
  );
}

export default function PlannerSidebar({ isOpen, onClose, mapViewRef }: PlannerSidebarProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // Re-enable map interactions when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      mapViewRef?.current?.enableInteractions();
    }
  }, [isOpen, mapViewRef]);

  /* Desktop (≥768px): Framer Motion right-side panel */
  if (!isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed inset-y-0 right-0 z-[80] max-w-[400px] w-full bg-surface border-l border-border shadow-[-10px_0_40px_rgba(0,0,0,0.1)] flex flex-col"
            aria-label="Planner sidebar"
            data-planner-sidebar
            onWheel={(e) => e.stopPropagation()}
          >
            <PlannerContent />
          </motion.aside>
        )}
      </AnimatePresence>
    );
  }

  /* Mobile (<768px): Full-screen vaul Drawer */
  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[79] bg-black/40" />
        <Drawer.Content
          className="fixed inset-0 z-[80] bg-surface flex flex-col"
          aria-label="Planner drawer"
          data-planner-sidebar
          onWheel={(e) => e.stopPropagation()}
        >
          <Drawer.Handle className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300" />
          <Drawer.Title className="sr-only">Trip Planner</Drawer.Title>
          <PlannerContent />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
