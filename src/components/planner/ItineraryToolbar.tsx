'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Save, Trash2, Pencil, ArrowLeft, Check, X } from 'lucide-react';
import usePlannerStore from '@/store/usePlannerStore';
import { useItineraries, useItineraryDetail } from '@/hooks/useItineraryQueries';
import {
  useCreateItinerary,
  useDeleteItinerary,
  useRenameItinerary,
  useSaveItinerary,
} from '@/hooks/useItineraryMutations';
import type { Itinerary, SaveDayItem } from '@/types';

export default function ItineraryToolbar() {
  const activeItinerary = usePlannerStore((s) => s.activeItinerary);
  const hasUnsavedChanges = usePlannerStore((s) => s.hasUnsavedChanges);
  const setItineraryData = usePlannerStore((s) => s.setItineraryData);

  const { data: itineraries = [], isLoading, isError } = useItineraries();

  const createMutation = useCreateItinerary();
  const deleteMutation = useDeleteItinerary();
  const renameMutation = useRenameItinerary();
  const saveMutation = useSaveItinerary();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingItineraryId, setLoadingItineraryId] = useState<string | null>(null);

  const { data: detailData } = useItineraryDetail(loadingItineraryId);

  const newNameInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating) newNameInputRef.current?.focus();
  }, [isCreating]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  // When detail data arrives, hydrate Zustand and clear the loading id
  useEffect(() => {
    if (detailData && loadingItineraryId) {
      setItineraryData(detailData.itinerary, detailData.dayItems);
      setLoadingItineraryId(null);
    }
  }, [detailData, loadingItineraryId, setItineraryData]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createMutation.mutateAsync({ name });
    setNewName('');
    setIsCreating(false);
  };

  const handleRename = async (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    await renameMutation.mutateAsync({ itineraryId: id, newName: name });
    setRenamingId(null);
    setRenameValue('');
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (deletingId) {
      await deleteMutation.mutateAsync(deletingId);
      // If we deleted the active itinerary, clear local state
      if (activeItinerary?.id === deletingId) {
        usePlannerStore.setState({
          activeItinerary: null,
          dayItems: {},
          hasUnsavedChanges: false,
        });
      }
    }
    setShowDeleteConfirm(false);
    setDeletingId(null);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setDeletingId(null);
  };

  const handleSave = async () => {
    if (!activeItinerary) return;
    const dayItems = usePlannerStore.getState().dayItems;
    const items: SaveDayItem[] = [];
    for (const [dayStr, pins] of Object.entries(dayItems)) {
      const dayNumber = Number(dayStr);
      for (const pin of pins) {
        items.push({ pinId: pin.id, dayNumber, sortOrder: pin.sort_order });
      }
    }
    await saveMutation.mutateAsync({ itineraryId: activeItinerary.id, items });
    usePlannerStore.setState({ hasUnsavedChanges: false });
  };

  const handleLoad = useCallback((id: string) => {
    setLoadingItineraryId(id);
  }, []);

  const handleBack = () => {
    usePlannerStore.setState({
      activeItinerary: null,
      dayItems: {},
      hasUnsavedChanges: false,
    });
  };

  const deletingName =
    deletingId
      ? (itineraries.find((it) => it.id === deletingId)?.name ??
         (activeItinerary?.id === deletingId ? activeItinerary.name : 'this itinerary'))
      : '';

  const deleteConfirmDialog = showDeleteConfirm && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleDeleteCancel}
    >
      <div
        className="bg-surface rounded-xl shadow-lg p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-primary mb-1">Delete trip</h3>
        <p className="text-sm text-neutral-500 mb-4">
          Are you sure you want to delete <span className="font-medium text-primary">{deletingName}</span>? This action is permanent and cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleDeleteCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-primary hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteConfirm}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  const isSaving = saveMutation.isPending;

  // --- Active itinerary header ---
  if (activeItinerary) {
    return (
      <>
      <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-border">
        <button
          onClick={handleBack}
          className="p-1.5 rounded-md hover:bg-neutral-100 transition-colors"
          aria-label="Back to itinerary list"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {renamingId === activeItinerary.id ? (
          <form
            onSubmit={(e) => { e.preventDefault(); handleRename(activeItinerary.id); }}
            className="flex items-center gap-1 flex-1 min-w-0"
          >
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="flex-1 min-w-0 text-sm font-medium bg-neutral-50 border border-border rounded px-2 py-1 outline-none focus:border-accent"
            />
            <button type="submit" className="p-1 text-accent hover:bg-neutral-100 rounded" aria-label="Confirm rename">
              <Check className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setRenamingId(null)} className="p-1 text-neutral-400 hover:bg-neutral-100 rounded" aria-label="Cancel rename">
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => { setRenamingId(activeItinerary.id); setRenameValue(activeItinerary.name); }}
            className="flex items-center gap-1.5 flex-1 min-w-0 group"
            aria-label="Rename itinerary"
          >
            <span className="text-sm font-semibold truncate">{activeItinerary.name}</span>
            <Pencil className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving || !hasUnsavedChanges}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-white disabled:opacity-40 hover:bg-accent/90 transition-colors"
          aria-label="Save itinerary"
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? 'Saving…' : 'Save'}
        </button>

        <button
          onClick={() => handleDeleteClick(activeItinerary.id)}
          className="p-1.5 rounded-md text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          aria-label="Delete itinerary"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {deleteConfirmDialog}
      </>
    );
  }

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="px-3 py-4 bg-surface border-b border-border flex items-center justify-center">
        <span className="text-xs text-neutral-400">Loading trips…</span>
      </div>
    );
  }

  // --- Error state ---
  if (isError) {
    return (
      <div className="px-3 py-4 bg-surface border-b border-border flex items-center justify-center">
        <span className="text-xs text-red-500">Failed to load trips. Please try again.</span>
      </div>
    );
  }

  // --- Itinerary list view ---
  return (
    <>
    <div className="px-3 py-2 bg-surface border-b border-border space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">My Trips</h2>
        {isCreating ? null : (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Trip
          </button>
        )}
      </div>

      {isCreating && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
          className="flex items-center gap-2"
        >
          <input
            ref={newNameInputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Trip name…"
            className="flex-1 text-sm bg-neutral-50 border border-border rounded px-2 py-1.5 outline-none focus:border-accent"
          />
          <button type="submit" className="p-1.5 text-accent hover:bg-neutral-100 rounded" aria-label="Create trip">
            <Check className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => { setIsCreating(false); setNewName(''); }} className="p-1.5 text-neutral-400 hover:bg-neutral-100 rounded" aria-label="Cancel">
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {itineraries.length === 0 && !isCreating ? (
        <p className="text-xs text-neutral-400 py-1">No trips yet — create one to start planning.</p>
      ) : (
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {itineraries.map((it) => (
            <ItineraryRow
              key={it.id}
              itinerary={it}
              isRenaming={renamingId === it.id}
              renameValue={renameValue}
              onLoad={() => handleLoad(it.id)}
              onStartRename={() => { setRenamingId(it.id); setRenameValue(it.name); }}
              onRenameChange={setRenameValue}
              onRenameSubmit={() => handleRename(it.id)}
              onRenameCancel={() => setRenamingId(null)}
              onDelete={() => handleDeleteClick(it.id)}
              renameInputRef={renameInputRef}
            />
          ))}
        </ul>
      )}
    </div>
    {deleteConfirmDialog}
    </>
  );
}

interface ItineraryRowProps {
  itinerary: Itinerary;
  isRenaming: boolean;
  renameValue: string;
  onLoad: () => void;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onDelete: () => void;
  renameInputRef: React.RefObject<HTMLInputElement>;
}

function ItineraryRow({
  itinerary,
  isRenaming,
  renameValue,
  onLoad,
  onStartRename,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
  renameInputRef,
}: ItineraryRowProps) {
  if (isRenaming) {
    return (
      <li className="flex items-center gap-1">
        <form
          onSubmit={(e) => { e.preventDefault(); onRenameSubmit(); }}
          className="flex items-center gap-1 flex-1 min-w-0"
        >
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            className="flex-1 min-w-0 text-sm bg-neutral-50 border border-border rounded px-2 py-1 outline-none focus:border-accent"
          />
          <button type="submit" className="p-1 text-accent hover:bg-neutral-100 rounded" aria-label="Confirm rename">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onRenameCancel} className="p-1 text-neutral-400 hover:bg-neutral-100 rounded" aria-label="Cancel rename">
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-1 group">
      <button
        onClick={onLoad}
        className="flex-1 min-w-0 text-left text-sm py-1.5 px-2 rounded hover:bg-neutral-50 transition-colors truncate"
      >
        {itinerary.name}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onStartRename(); }}
        className="p-1 text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-accent hover:bg-neutral-100 rounded transition-all"
        aria-label={`Rename ${itinerary.name}`}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1 text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 rounded transition-all"
        aria-label={`Delete ${itinerary.name}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}
