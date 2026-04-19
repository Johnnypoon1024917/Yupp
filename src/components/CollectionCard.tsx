'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MapPin, ExternalLink } from 'lucide-react';
import type { Collection, Pin } from '@/types';

export interface CollectionCardProps {
  collection: Collection;
  pins: Pin[];
  onClick: (collectionId: string) => void;
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
}: CollectionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleClick = () => {
    setExpanded((prev) => !prev);
    onClick(collection.id);
  };

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
      {/* Card header — clickable */}
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-gray-50"
        aria-expanded={expanded}
      >
        <ImageGrid pins={pins} />

        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-primary truncate block">
            {collection.name}
          </span>
          <span className="text-xs text-gray-400">
            {pins.length} {pins.length === 1 ? 'pin' : 'pins'}
          </span>
        </div>

        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-400 flex-shrink-0"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>

      {/* Expanded pin list */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
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
