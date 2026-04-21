'use client';

import { AnimatePresence, motion } from 'framer-motion';
import useToastStore, { type ToastVariant } from '@/store/useToastStore';

const variantStyles: Record<ToastVariant, string> = {
  error: 'bg-red-50 text-red-800',
  success: 'bg-green-50 text-green-800',
  info: 'bg-blue-50 text-blue-800',
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

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
            className={`rounded-lg px-4 py-2 shadow-md text-sm ${variantStyles[toast.variant]}`}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
