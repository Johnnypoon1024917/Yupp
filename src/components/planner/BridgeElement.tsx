'use client';

/**
 * Visual connector between timeline cards.
 * Sprint 2: renders a dashed line with a "Calculating..." placeholder.
 * Sprint 3 will wire in actual travel times from the Distance Matrix API.
 */
export default function BridgeElement() {
  return (
    <div className="flex items-center justify-center py-2">
      <div className="flex items-center gap-2">
        <span className="w-0 h-5 border-l border-dashed border-neutral-300" />
        <span className="text-[11px] text-neutral-400 italic">Calculating…</span>
        <span className="w-0 h-5 border-l border-dashed border-neutral-300" />
      </div>
    </div>
  );
}
