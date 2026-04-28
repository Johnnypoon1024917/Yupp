'use client';

import { AnimatePresence, motion } from 'framer-motion';
import useToastStore, { type ToastVariant } from '@/store/useToastStore';

const variantStyles: Record<ToastVariant, string> = {
  error: 'bg-red-50 text-red-800',
  success: 'bg-green-50 text-green-800',
  info: 'bg-blue-50 text-blue-800',
  undo: 'bg-surface-sunken text-ink-1 shadow-elev-2',
};

const UNDO_DURATION_MS = 5000;

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.slice(-3).map((toast) => (
          <motion.div
            key={toast.id}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className={`relative overflow-hidden rounded-lg px-4 py-2 shadow-md text-sm ${variantStyles[toast.variant]}`}
          >
            {toast.variant === 'undo' ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <span>{toast.message}</span>
                  <button
                    type="button"
                    className="shrink-0 font-semibold text-brand hover:text-brand-ink transition-colors"
                    onClick={() => {
                      toast.onUndo?.();
                    }}
                    aria-label="Undo action"
                  >
                    Undo
                  </button>
                </div>
                {/* 5-second countdown progress bar */}
                <motion.div
                  className="absolute bottom-0 left-0 h-0.5 bg-brand"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: UNDO_DURATION_MS / 1000, ease: 'linear' }}
                />
              </>
            ) : (
              toast.message
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
