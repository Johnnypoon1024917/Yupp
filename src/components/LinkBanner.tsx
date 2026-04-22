'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface LinkBannerProps {
  url: string;
  platformName: string;
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * A non-intrusive notification banner shown when a supported travel link
 * is detected on the clipboard. Slides down from the top with a fade,
 * auto-dismisses after 8 seconds.
 */
export default function LinkBanner({ platformName, onAccept, onDismiss }: LinkBannerProps) {
  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        key="link-banner"
        role="alert"
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -40 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed left-1/2 -translate-x-1/2 z-[35] flex items-center gap-3 rounded-xl bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-sm text-sm"
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <span className="whitespace-nowrap">
          📍 Detected a link from {platformName}. Pin it now?
        </span>

        <button
          type="button"
          onClick={onAccept}
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Yes
        </button>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X size={14} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
