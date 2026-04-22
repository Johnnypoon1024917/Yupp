'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MapPin, ExternalLink, MoreVertical, Check, X } from 'lucide-react';
import type { Collection, Pin } from '@/types';

export interface CollectionCardProps {
  collection: Collection;
  pins: Pin[];
  onClick: (collectionId: string) => void;
  onRename?: (id: string, newName: string) => void;
  onDelete?: (id: string) => void;
  isDefault?: boolean;
}

/** 2×2 image grid preview showing the first 4 pin images. */
function ImageGrid({ pins }: { pins: Pin[] }) {
  const slots = Array.from({ length: 4 }, (_, i) => pins[i] ?? null);

  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-1 w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
      {slots.map((pin, i) =>
        pin ? (
          <img
            key={pin.id}
            src={pin.imageUrl}
            alt={pin.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            key={`empty-${i}`}
            className="w-full h-full bg-gray-100"
          />
        ),
      )}
    </div>
  );
}

/** Single pin row shown when a collection is expanded. */
function PinRow({ pin }: { pin: Pin }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <img
        src={pin.imageUrl}
        alt={pin.title}
        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-border"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary truncate">{pin.title}</p>
        <a
          href={pin.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-accent hover:underline truncate"
        >
          <ExternalLink size={10} className="flex-shrink-0" />
          <span className="truncate">{pin.sourceUrl}</span>
        </a>
      </div>
    </div>
  );
}

export default function CollectionCard({
  collection,
  pins,
  onClick,
  onRename,
  onDelete,
  isDefault = false,
}: CollectionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(collection.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = () => {
    setExpanded((prev) => !prev);
    onClick(collection.id);
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && onRename) {
      onRename(collection.id, trimmed);
      setIsRenaming(false);
      setMenuOpen(false);
    }
  };

  const handleRenameCancel = () => {
    setRenameValue(collection.name);
    setIsRenaming(false);
  };

  const handleDelete = () => {
    if (onDelete && window.confirm(`Delete "${collection.name}"? Pins will be moved to Unorganized.`)) {
      onDelete(collection.id);
    }
    setMenuOpen(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-visible">
      {/* Card header — clickable */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        className="flex w-full items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-gray-50"
        aria-expanded={expanded}
      >
        <ImageGrid pins={pins} />

        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') handleRenameCancel();
                }}
                className="text-sm font-semibold text-primary border border-border rounded px-1.5 py-0.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRenameSubmit(); }}
                className="p-0.5 text-green-600 hover:text-green-700"
                aria-label="Confirm rename"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRenameCancel(); }}
                className="p-0.5 text-gray-400 hover:text-gray-600"
                aria-label="Cancel rename"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <span className="text-sm font-semibold text-primary truncate block">
                {collection.name}
              </span>
              <span className="text-xs text-gray-400">
                {pins.length} {pins.length === 1 ? 'pin' : 'pins'}
              </span>
            </>
          )}
        </div>

        {/* MoreVertical menu — hidden for default collection */}
        {!isDefault && (
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((prev) => !prev); }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              aria-label="Collection options"
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen && !isRenaming && (
              <div className="absolute right-0 top-full mt-1 z-[100] w-32 rounded-lg border border-border bg-surface shadow-md py-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameValue(collection.name);
                    setIsRenaming(true);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-primary hover:bg-gray-50 transition-colors"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}

        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-400 flex-shrink-0"
        >
          <ChevronDown size={16} />
        </motion.span>
      </div>

      {/* Expanded pin list */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden rounded-b-2xl"
          >
            <div className="px-3 pb-3 border-t border-border">
              {pins.length === 0 ? (
                <p className="py-3 text-xs text-gray-400 flex items-center gap-1">
                  <MapPin size={12} /> No pins yet
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {pins.map((pin) => (
                    <PinRow key={pin.id} pin={pin} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
