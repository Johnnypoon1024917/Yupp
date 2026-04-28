'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Drawer } from 'vaul';
import { X, Search, ChevronDown, Check, Trash2, FolderInput } from 'lucide-react';
import useTravelPinStore from '@/store/useTravelPinStore';
import useToastStore from '@/store/useToastStore';
import { haptics } from '@/utils/haptics';
import EmptyState from '@/components/empty-states/EmptyState';
import CompassIllustration from '@/components/empty-states/illustrations/CompassIllustration';
import type { Pin, Collection } from '@/types';

/* ------------------------------------------------------------------ */
/*  Pure filtering / sorting helpers — exported for testability        */
/* ------------------------------------------------------------------ */

/**
 * Filters pins whose title or address contain the query string
 * (case-insensitive). Returns all pins when query is empty.
 */
export function filterPinsByQuery(pins: Pin[], query: string): Pin[] {
  const q = query.trim().toLowerCase();
  if (!q) return pins;
  return pins.filter((pin) => {
    const title = pin.title?.toLowerCase() ?? '';
    const address = pin.address?.toLowerCase() ?? '';
    return title.includes(q) || address.includes(q);
  });
}

/**
 * Filters pins belonging to a specific category (collection name).
 * Uses the collections array to resolve collectionId → name.
 * Returns all pins when category is null.
 */
export function filterPinsByCategory(
  pins: Pin[],
  category: string | null,
  collections: Collection[],
): Pin[] {
  if (!category) return pins;
  const collectionMap = new Map(collections.map((c) => [c.id, c.name]));
  return pins.filter((pin) => {
    const name = collectionMap.get(pin.collectionId);
    return name === category;
  });
}

/**
 * Sorts pins by the given mode:
 *  - 'recent'  → newest first (by createdAt descending)
 *  - 'rated'   → highest rating first (nulls last)
 *  - 'alpha'   → alphabetical by title (A → Z)
 */
export function sortPins(
  pins: Pin[],
  mode: 'recent' | 'rated' | 'alpha',
): Pin[] {
  const copy = [...pins];
  switch (mode) {
    case 'recent':
      return copy.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case 'rated':
      return copy.sort((a, b) => {
        const ra = a.rating ?? -1;
        const rb = b.rating ?? -1;
        return rb - ra;
      });
    case 'alpha':
      return copy.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
      );
    default:
      return copy;
  }
}

/* ------------------------------------------------------------------ */
/*  Sort mode labels                                                   */
/* ------------------------------------------------------------------ */

const SORT_OPTIONS: { value: 'recent' | 'rated' | 'alpha'; label: string }[] = [
  { value: 'recent', label: 'Recently added' },
  { value: 'rated', label: 'Highest rated' },
  { value: 'alpha', label: 'Alphabetical' },
];

/* ------------------------------------------------------------------ */
/*  Skeleton card — animated pulse placeholder matching grid layout    */
/* ------------------------------------------------------------------ */

function SkeletonCard() {
  return (
    <div className="relative w-full aspect-[4/5] rounded-card bg-surface-sunken animate-pulse overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col gap-2">
        <div className="h-4 w-3/4 rounded bg-border" />
        <div className="h-3 w-1/3 rounded bg-border" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export interface DiscoverFeedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DiscoverFeed({ open, onOpenChange }: DiscoverFeedProps) {
  const pins = useTravelPinStore((s) => s.pins);

  /* --- hydration flag for skeleton loading --- */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const collections = useTravelPinStore((s) => s.collections);
  const setActivePinId = useTravelPinStore((s) => s.setActivePinId);
  const removePin = useTravelPinStore((s) => s.removePin);
  const addUndoToast = useToastStore((s) => s.addUndoToast);
  const addPendingDelete = useToastStore((s) => s.addPendingDelete);
  const removePendingDelete = useToastStore((s) => s.removePendingDelete);

  /* --- local UI state --- */
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'recent' | 'rated' | 'alpha'>('recent');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  /* --- multi-select state --- */
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedPinIds, setSelectedPinIds] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const sortListboxRef = useRef<HTMLDivElement>(null);
  const [sortFocusIndex, setSortFocusIndex] = useState(-1);

  /* --- derive unique category names from collections --- */
  const categoryNames = useMemo(() => {
    const names = collections.map((c) => c.name);
    // Deduplicate while preserving order
    return [...new Set(names)];
  }, [collections]);

  /* --- filtering + sorting pipeline --- */
  const displayedPins = useMemo(() => {
    let result = filterPinsByQuery(pins, searchQuery);
    result = filterPinsByCategory(result, activeCategory, collections);
    result = sortPins(result, sortMode);
    return result;
  }, [pins, searchQuery, activeCategory, sortMode, collections]);

  /* --- single pin remove (undo toast pattern) --- */
  const handleRemove = useCallback(
    (e: React.MouseEvent, pinId: string) => {
      e.stopPropagation();
      const snapshot = pins.find((p) => p.id === pinId);
      if (!snapshot) return;

      // Optimistic removal
      removePin(pinId);
      addPendingDelete(pinId, snapshot);

      addUndoToast(`Removed "${snapshot.title}"`, () => {
        // Restore pin on undo
        useTravelPinStore.getState().addPin({
          title: snapshot.title,
          description: snapshot.description,
          imageUrl: snapshot.imageUrl,
          sourceUrl: snapshot.sourceUrl,
          latitude: snapshot.latitude,
          longitude: snapshot.longitude,
          placeId: snapshot.placeId,
          primaryType: snapshot.primaryType,
          rating: snapshot.rating,
          address: snapshot.address,
          openingHours: snapshot.openingHours,
          priceLevel: snapshot.priceLevel,
          images: snapshot.images,
        });
        removePendingDelete(pinId);
      });
    },
    [pins, removePin, addUndoToast, addPendingDelete, removePendingDelete],
  );

  const handleCategoryToggle = useCallback((name: string) => {
    setActiveCategory((prev) => (prev === name ? null : name));
  }, []);

  /* --- multi-select helpers --- */
  const toggleSelection = useCallback(
    (pinId: string) => {
      haptics.tap();
      setSelectedPinIds((prev) => {
        const next = new Set(prev);
        if (next.has(pinId)) {
          next.delete(pinId);
        } else {
          next.add(pinId);
        }
        // Exit multi-select if nothing selected
        if (next.size === 0) {
          setMultiSelectMode(false);
        }
        return next;
      });
    },
    [],
  );

  const enterMultiSelect = useCallback(
    (pinId: string) => {
      haptics.tap();
      setMultiSelectMode(true);
      setSelectedPinIds(new Set([pinId]));
    },
    [],
  );

  const exitMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedPinIds(new Set());
  }, []);

  /* --- long-press handlers --- */
  const handlePointerDown = useCallback(
    (pinId: string) => {
      if (multiSelectMode) return; // already in multi-select
      longPressTimerRef.current = setTimeout(() => {
        enterMultiSelect(pinId);
        longPressTimerRef.current = null;
      }, 500);
    },
    [multiSelectMode, enterMultiSelect],
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  /* --- card click handler (context-aware) --- */
  const handleCardClick = useCallback(
    (pinId: string) => {
      if (multiSelectMode) {
        toggleSelection(pinId);
      } else {
        setActivePinId(pinId);
        onOpenChange(false);
      }
    },
    [multiSelectMode, toggleSelection, setActivePinId, onOpenChange],
  );

  /* --- bulk delete --- */
  const handleBulkDelete = useCallback(() => {
    const idsToDelete = [...selectedPinIds];
    const snapshots = idsToDelete
      .map((id) => pins.find((p) => p.id === id))
      .filter((p): p is Pin => p != null);

    // Optimistic removal
    for (const snap of snapshots) {
      removePin(snap.id);
      addPendingDelete(snap.id, snap);
    }

    exitMultiSelect();

    const count = snapshots.length;
    addUndoToast(`Removed ${count} ${count === 1 ? 'place' : 'places'}`, () => {
      // Restore all pins on undo
      for (const snap of snapshots) {
        useTravelPinStore.getState().addPin({
          title: snap.title,
          description: snap.description,
          imageUrl: snap.imageUrl,
          sourceUrl: snap.sourceUrl,
          latitude: snap.latitude,
          longitude: snap.longitude,
          placeId: snap.placeId,
          primaryType: snap.primaryType,
          rating: snap.rating,
          address: snap.address,
          openingHours: snap.openingHours,
          priceLevel: snap.priceLevel,
          images: snap.images,
        });
        removePendingDelete(snap.id);
      }
    });
  }, [selectedPinIds, pins, removePin, addPendingDelete, exitMultiSelect, addUndoToast, removePendingDelete]);

  /* --- keyboard support for multi-select --- */
  useEffect(() => {
    if (!multiSelectMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitMultiSelect();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [multiSelectMode, exitMultiSelect]);

  /* --- sort menu: focus management + close on outside click --- */
  useEffect(() => {
    if (sortMenuOpen) {
      // Set initial focus index to the currently selected sort option
      const activeIndex = SORT_OPTIONS.findIndex((o) => o.value === sortMode);
      setSortFocusIndex(activeIndex >= 0 ? activeIndex : 0);

      // Focus the active option after render
      requestAnimationFrame(() => {
        const options = sortListboxRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
        const idx = activeIndex >= 0 ? activeIndex : 0;
        options?.[idx]?.focus();
      });
    } else {
      setSortFocusIndex(-1);
    }
  }, [sortMenuOpen, sortMode]);

  /* --- sort menu: close on outside click --- */
  useEffect(() => {
    if (!sortMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        sortListboxRef.current && !sortListboxRef.current.contains(target) &&
        sortButtonRef.current && !sortButtonRef.current.contains(target)
      ) {
        setSortMenuOpen(false);
        sortButtonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sortMenuOpen]);

  /* --- sort menu keyboard handler --- */
  const handleSortListboxKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const next = (sortFocusIndex + 1) % SORT_OPTIONS.length;
          setSortFocusIndex(next);
          const options = sortListboxRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
          options?.[next]?.focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prev = (sortFocusIndex - 1 + SORT_OPTIONS.length) % SORT_OPTIONS.length;
          setSortFocusIndex(prev);
          const options = sortListboxRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
          options?.[prev]?.focus();
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setSortMenuOpen(false);
          sortButtonRef.current?.focus();
          break;
        }
        case 'Home': {
          e.preventDefault();
          setSortFocusIndex(0);
          const options = sortListboxRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
          options?.[0]?.focus();
          break;
        }
        case 'End': {
          e.preventDefault();
          const last = SORT_OPTIONS.length - 1;
          setSortFocusIndex(last);
          const options = sortListboxRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
          options?.[last]?.focus();
          break;
        }
      }
    },
    [sortFocusIndex],
  );

  /* --- sort trigger keyboard handler (open on ArrowDown/Enter/Space) --- */
  const handleSortButtonKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSortMenuOpen(true);
      }
    },
    [],
  );

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[100] mx-auto w-full max-w-[448px] h-[85vh] flex flex-col bg-surface-raised rounded-t-sheet shadow-elev-3 outline-none"
          aria-label="Discover feed"
        >
          <Drawer.Title className="sr-only">Discover</Drawer.Title>

          {/* ---- Header ---- */}
          <div className="px-6 pt-8 pb-4 flex flex-col gap-1 bg-surface rounded-t-sheet">
            <div className="mx-auto mb-4 h-[5px] w-12 rounded-pill bg-border-strong flex-shrink-0" />
            <h1 className="text-title text-ink-1">Saved Places</h1>
            <p className="text-caption text-ink-3">
              {pins.length} {pins.length === 1 ? 'place' : 'places'} saved
            </p>
          </div>

          {/* ---- Sticky search + filters ---- */}
          <div className="sticky top-0 z-10 bg-surface px-4 pb-3 flex flex-col gap-2 border-b border-border">
            {/* Search bar */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search places…"
                className="w-full pl-9 pr-3 py-2 rounded-control bg-surface-sunken text-body text-ink-1 placeholder:text-ink-3 outline-none focus:ring-2 focus:ring-brand"
                aria-label="Search saved places"
              />
            </div>

            {/* Category filter chips + sort button row */}
            <div className="flex items-center gap-2">
              {/* Scrollable chips */}
              <div className="flex-1 overflow-x-auto flex gap-2 scrollbar-hide" role="group" aria-label="Category filters">
                {categoryNames.map((name) => {
                  const isActive = activeCategory === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleCategoryToggle(name)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-chip text-caption transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-brand-soft text-brand-ink'
                          : 'bg-surface-sunken text-ink-2 hover:bg-border'
                      }`}
                      aria-pressed={isActive}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>

              {/* Sort menu */}
              <div className="relative flex-shrink-0">
                <button
                  ref={sortButtonRef}
                  type="button"
                  onClick={() => setSortMenuOpen((v) => !v)}
                  onKeyDown={handleSortButtonKeyDown}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-chip bg-surface-sunken text-caption text-ink-2 hover:bg-border transition-colors"
                  aria-haspopup="listbox"
                  aria-expanded={sortMenuOpen}
                  aria-label="Sort places"
                >
                  Sort
                  <ChevronDown size={14} aria-hidden="true" />
                </button>

                {sortMenuOpen && (
                  <div
                    ref={sortListboxRef}
                    role="listbox"
                    aria-label="Sort options"
                    aria-activedescendant={sortFocusIndex >= 0 ? `sort-option-${SORT_OPTIONS[sortFocusIndex].value}` : undefined}
                    onKeyDown={handleSortListboxKeyDown}
                    className="absolute right-0 top-full mt-1 w-44 bg-surface rounded-control shadow-elev-2 border border-border py-1 z-20"
                  >
                    {SORT_OPTIONS.map((opt, idx) => (
                      <button
                        key={opt.value}
                        id={`sort-option-${opt.value}`}
                        type="button"
                        role="option"
                        tabIndex={sortFocusIndex === idx ? 0 : -1}
                        aria-selected={sortMode === opt.value}
                        onClick={() => {
                          setSortMode(opt.value);
                          setSortMenuOpen(false);
                          sortButtonRef.current?.focus();
                        }}
                        className={`w-full text-left px-3 py-2 text-caption flex items-center justify-between transition-colors ${
                          sortMode === opt.value
                            ? 'text-brand-ink bg-brand-soft/40'
                            : 'text-ink-2 hover:bg-surface-sunken'
                        }`}
                      >
                        {opt.label}
                        {sortMode === opt.value && (
                          <Check size={14} className="text-brand" aria-hidden="true" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---- Scrollable grid ---- */}
          {!hydrated ? (
            /* Skeleton loading cards while store hydrates */
            <div className="flex-1 overflow-y-auto px-4 py-4 grid grid-cols-2 gap-3 auto-rows-min pb-[100px]">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : pins.length === 0 ? (
            <div className="flex-1">
              <EmptyState
                illustration={<CompassIllustration />}
                message="Start discovering places by pasting a link"
                ctaLabel="Start discovering"
                onCtaClick={() => onOpenChange(false)}
              />
            </div>
          ) : displayedPins.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Search size={36} className="mb-3 text-ink-3" aria-hidden="true" />
              <p className="text-body text-ink-3">
                No places match your search.
              </p>
            </div>
          ) : (
            <div className={`flex-1 overflow-y-auto px-4 py-4 grid grid-cols-2 gap-3 auto-rows-min ${multiSelectMode ? 'pb-[160px]' : 'pb-[100px]'}`}>
              {displayedPins.map((pin) => {
                const isSelected = selectedPinIds.has(pin.id);
                return (
                  <div key={pin.id} className="relative group/card">
                    {/* Remove button — hidden in multi-select mode */}
                    {!multiSelectMode && (
                      <button
                        type="button"
                        onClick={(e) => handleRemove(e, pin.id)}
                        className="absolute top-2 right-2 z-10 p-1.5 bg-black/40 backdrop-blur-md rounded-full text-white opacity-0 group-hover/card:opacity-100 focus:opacity-100 transition-opacity active:bg-black/60"
                        aria-label={`Remove ${pin.title}`}
                      >
                        <X size={14} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                    )}

                    {/* Check overlay for multi-select */}
                    {multiSelectMode && (
                      <div
                        className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors pointer-events-none ${
                          isSelected
                            ? 'bg-brand border-brand'
                            : 'bg-black/30 border-white/70'
                        }`}
                      >
                        {isSelected && (
                          <Check size={14} className="text-white" strokeWidth={3} aria-hidden="true" />
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCardClick(pin.id)}
                      onPointerDown={() => handlePointerDown(pin.id)}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onPointerCancel={cancelLongPress}
                      onKeyDown={(e) => {
                        if (multiSelectMode && (e.key === ' ' || e.key === 'Enter')) {
                          e.preventDefault();
                          toggleSelection(pin.id);
                        }
                      }}
                      className={`relative w-full aspect-[4/5] rounded-card overflow-hidden cursor-pointer shadow-elev-1 focus:outline-none focus:ring-2 focus:ring-brand ${
                        multiSelectMode && isSelected ? 'ring-2 ring-brand' : ''
                      }`}
                      aria-label={multiSelectMode ? `${isSelected ? 'Deselect' : 'Select'} ${pin.title}` : pin.title}
                      aria-pressed={multiSelectMode ? isSelected : undefined}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pin.imageUrl}
                        alt={pin.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                      />
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      {/* Selection dimming overlay */}
                      {multiSelectMode && !isSelected && (
                        <div className="absolute inset-0 bg-black/30" />
                      )}
                      {/* Text content docked at bottom */}
                      <div className="absolute bottom-0 left-0 p-4 w-full">
                        <h3 className="text-white font-bold text-body leading-[20px] tracking-[-0.2px] line-clamp-2 drop-shadow-md">
                          {pin.title}
                        </h3>
                        {pin.rating != null && (
                          <p className="text-white/70 text-micro mt-1">
                            ⭐ {pin.rating.toFixed(1)}
                          </p>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ---- Bulk action bar ---- */}
          {multiSelectMode && selectedPinIds.size > 0 && (
            <div className="absolute inset-x-0 bottom-0 z-20 bg-surface border-t border-border px-4 py-3 shadow-elev-2 flex items-center justify-between gap-3">
              <p className="text-caption text-ink-2">
                {selectedPinIds.size} {selectedPinIds.size === 1 ? 'place' : 'places'} selected
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exitMultiSelect}
                  className="px-3 py-2 rounded-control text-caption text-ink-2 hover:bg-surface-sunken transition-colors"
                  aria-label="Cancel selection"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-danger text-white text-caption hover:bg-danger/90 transition-colors"
                  aria-label={`Delete ${selectedPinIds.size} selected places`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Delete
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-brand text-white text-caption hover:bg-brand/90 transition-colors"
                  aria-label={`Move ${selectedPinIds.size} selected places to collection`}
                >
                  <FolderInput size={14} aria-hidden="true" />
                  Move
                </button>
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
