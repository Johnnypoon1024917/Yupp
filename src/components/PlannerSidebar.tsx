'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from 'vaul';
import ItineraryToolbar from '@/components/planner/ItineraryToolbar';
import TripTimeline from '@/components/planner/TripTimeline';

export interface PlannerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Shared planner content — rendered inside both desktop panel and mobile drawer. */
function PlannerContent() {
  return (
    <>
      <ItineraryToolbar />
      <TripTimeline className="flex-1 overflow-y-auto p-4" />
    </>
  );
}

export default function PlannerSidebar({ isOpen, onClose }: PlannerSidebarProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

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
        >
          <Drawer.Handle className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300" />
          <Drawer.Title className="sr-only">Trip Planner</Drawer.Title>
          <PlannerContent />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
