import { create } from 'zustand';
import type { Pin } from '@/types';
import { createClient } from '@/utils/supabase/client';

export type ToastVariant = 'success' | 'error' | 'info' | 'undo';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
  onUndo?: () => void;
  undoTimeoutId?: ReturnType<typeof setTimeout>;
}

export interface PendingDelete {
  pinId: string;
  pinSnapshot: Pin;
  timestamp: number;
}

export interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, variant: ToastVariant) => void;
  addUndoToast: (message: string, onUndo: () => void) => void;
  removeToast: (id: string) => void;
  addPendingDelete: (pinId: string, pinSnapshot: Pin) => void;
  removePendingDelete: (pinId: string) => void;
  commitStalePendingDeletes: () => void;
}

// ---------------------------------------------------------------------------
// localStorage helpers (SSR-safe)
// ---------------------------------------------------------------------------

const PENDING_DELETES_KEY = 'pending-deletes';

function readPendingDeletes(): PendingDelete[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_DELETES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingDelete[];
  } catch {
    return [];
  }
}

function writePendingDeletes(entries: PendingDelete[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (entries.length === 0) {
      localStorage.removeItem(PENDING_DELETES_KEY);
    } else {
      localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(entries));
    }
  } catch {
    // Silently ignore storage errors (quota, private browsing, etc.)
  }
}

/**
 * Commit a single pending delete to the cloud (Supabase).
 * Fire-and-forget — errors are logged but not surfaced.
 */
function commitCloudDelete(pinId: string): void {
  try {
    const supabase = createClient();
    supabase
      .from('pins')
      .delete()
      .eq('id', pinId)
      .then(({ error }) => {
        if (error) {
          console.error('[commitCloudDelete] Failed to delete pin from cloud:', error);
        }
      });
  } catch (err) {
    console.error('[commitCloudDelete] Supabase client error:', err);
  }
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

  addUndoToast: (message, onUndo) => {
    const id = crypto.randomUUID();

    const undoTimeoutId = setTimeout(() => {
      get().removeToast(id);
    }, 5000);

    const toast: Toast = {
      id,
      message,
      variant: 'undo',
      createdAt: Date.now(),
      onUndo: () => {
        clearTimeout(undoTimeoutId);
        onUndo();
        get().removeToast(id);
      },
      undoTimeoutId,
    };

    set((state) => {
      const updated = [...state.toasts, toast];
      if (updated.length > 3) {
        return { toasts: updated.slice(updated.length - 3) };
      }
      return { toasts: updated };
    });
  },

  removeToast: (id) => {
    set((state) => {
      const toast = state.toasts.find((t) => t.id === id);
      if (toast?.undoTimeoutId) {
        clearTimeout(toast.undoTimeoutId);
      }
      return {
        toasts: state.toasts.filter((t) => t.id !== id),
      };
    });
  },

  addPendingDelete: (pinId, pinSnapshot) => {
    const entries = readPendingDeletes();
    const entry: PendingDelete = { pinId, pinSnapshot, timestamp: Date.now() };
    writePendingDeletes([...entries, entry]);
  },

  removePendingDelete: (pinId) => {
    const entries = readPendingDeletes();
    writePendingDeletes(entries.filter((e) => e.pinId !== pinId));
  },

  commitStalePendingDeletes: () => {
    const entries = readPendingDeletes();
    if (entries.length === 0) return;

    const now = Date.now();
    const UNDO_WINDOW_MS = 5000;
    const stale = entries.filter((e) => now - e.timestamp >= UNDO_WINDOW_MS);
    const fresh = entries.filter((e) => now - e.timestamp < UNDO_WINDOW_MS);

    // Commit stale entries to cloud
    for (const entry of stale) {
      commitCloudDelete(entry.pinId);
    }

    // Keep only fresh entries in localStorage
    writePendingDeletes(fresh);
  },
}));

export default useToastStore;
