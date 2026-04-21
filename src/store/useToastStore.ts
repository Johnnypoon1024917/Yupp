import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
}

export interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, variant: ToastVariant) => void;
  removeToast: (id: string) => void;
}

const useToastStore = create<ToastStore>()((set, get) => ({
  toasts: [],

  addToast: (message, variant) => {
    const id = crypto.randomUUID();
    const toast: Toast = {
      id,
      message,
      variant,
      createdAt: Date.now(),
    };

    set((state) => {
      const updated = [...state.toasts, toast];
      // Enforce max 3 — evict oldest (first element) if over limit
      if (updated.length > 3) {
        return { toasts: updated.slice(updated.length - 3) };
      }
      return { toasts: updated };
    });

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

export default useToastStore;
