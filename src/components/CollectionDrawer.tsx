'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from 'vaul';
import { Menu, X, Plus, Check } from 'lucide-react';
import useTravelPinStore from '@/store/useTravelPinStore';
import CollectionCard from '@/components/CollectionCard';
import { createClient } from '@/utils/supabase/client';

export interface CollectionDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
}

/** Shared drawer content — rendered inside both desktop panel and mobile bottom-sheet. */
function DrawerContent() {
  const collections = useTravelPinStore((s) => s.collections);
  const pins = useTravelPinStore((s) => s.pins);
  const setActiveCollection = useTravelPinStore((s) => s.setActiveCollection);
  const renameCollection = useTravelPinStore((s) => s.renameCollection);
  const removeCollection = useTravelPinStore((s) => s.removeCollection);
  const addCollection = useTravelPinStore((s) => s.addCollection);
  const user = useTravelPinStore((s) => s.user);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  // Ensure "Unorganized" is always first
  const sorted = [...collections].sort((a, b) => {
    if (a.id === 'unorganized') return -1;
    if (b.id === 'unorganized') return 1;
    return 0;
  });

  const handleCollectionClick = (collectionId: string) => {
    setActiveCollection(collectionId);
  };

  const handleRename = useCallback(
    (id: string, newName: string) => {
      renameCollection(id, newName);
    },
    [renameCollection],
  );

  const handleDelete = useCallback(
    (id: string) => {
      removeCollection(id);

      // Fire-and-forget Supabase delete for authenticated users
      if (user) {
        try {
          const supabase = createClient();
          supabase
            .from('collections')
            .delete()
            .eq('id', id)
            .then(({ error }) => {
              if (error) {
                console.error('[CollectionDrawer] Failed to delete collection from Supabase:', error);
              }
            });
        } catch (err) {
          console.error('[CollectionDrawer] Supabase client error:', err);
        }
      }
    },
    [removeCollection, user],
  );

  const handleCreateSave = () => {
    const trimmed = newName.trim();
    if (trimmed) {
      addCollection(trimmed);
      setNewName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold tracking-tight text-primary">
          Collections
        </h2>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-primary transition-colors"
          aria-label="New collection"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

      {isCreating && (
        <div className="flex items-center gap-2 mb-3">
          <input
            autoFocus
            type="text"
            placeholder="Collection name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSave();
              if (e.key === 'Escape') { setIsCreating(false); setNewName(''); }
            }}
            className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={handleCreateSave}
            className="p-1.5 text-green-600 hover:text-green-700 rounded transition-colors"
            aria-label="Save new collection"
          >
            <Check size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => { setIsCreating(false); setNewName(''); }}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
            aria-label="Cancel new collection"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {collections.length === 0 ? (
        <p className="text-sm text-gray-400">No collections yet.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((collection) => {
            const collectionPins = pins.filter(
              (p) => p.collectionId === collection.id,
            );
            return (
              <CollectionCard
                key={collection.id}
                collection={collection}
                pins={collectionPins}
                onClick={handleCollectionClick}
                onRename={handleRename}
                onDelete={handleDelete}
                isDefault={collection.id === 'unorganized'}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CollectionDrawer({
  isOpen,
  onToggle,
}: CollectionDrawerProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        onClick={onToggle}
        aria-label={isOpen ? 'Close collections drawer' : 'Open collections drawer'}
        className="fixed top-4 left-4 z-[45] flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/80 backdrop-blur-md shadow-sm transition-colors hover:bg-gray-50"
      >
        {isOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
      </button>

      {/* Desktop: Framer Motion slide-in panel */}
      {!isMobile && (
        <AnimatePresence>
          {isOpen && (
            <motion.aside
              initial={{ x: -360 }}
              animate={{ x: 0 }}
              exit={{ x: -360 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-[30] w-[360px] border-r border-border bg-surface shadow-sm overflow-y-auto"
              aria-label="Collections drawer"
            >
              {/* Top spacer so content clears the toggle button */}
              <div className="h-16" />
              <DrawerContent />
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      {/* Mobile: vaul bottom-sheet with drag-to-dismiss */}
      {isMobile && (
        <Drawer.Root
          open={isOpen}
          onOpenChange={(open) => {
            if (open !== isOpen) onToggle();
          }}
        >
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-[29] bg-black/40" />
            <Drawer.Content
              className="fixed inset-x-0 bottom-0 z-[30] rounded-t-2xl border-t border-border bg-surface"
              aria-label="Collections drawer"
            >
              <Drawer.Handle className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300" />
              <Drawer.Title className="sr-only">Collections</Drawer.Title>
              <div className="max-h-[70vh] overflow-y-auto pb-6">
                <DrawerContent />
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </>
  );
}
