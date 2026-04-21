'use client';

import { MapPin } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <MapPin className="w-10 h-10 text-neutral-400" />
      <p className="text-neutral-400 text-[13px] text-center mt-3 max-w-[280px]">
        Your canvas is empty. Paste a TikTok or Xiaohongshu link to start building your dream trip.
      </p>
    </div>
  );
}
