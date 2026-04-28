'use client';

import React from 'react';

export interface EmptyStateProps {
  illustration: React.ReactNode;
  message: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

export default function EmptyState({
  illustration,
  message,
  ctaLabel,
  onCtaClick,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-10 gap-4">
      <div className="w-32 h-32 flex items-center justify-center" aria-hidden="true">
        {illustration}
      </div>
      <p className="text-body text-ink-2 text-center max-w-[280px]">{message}</p>
      {ctaLabel && onCtaClick && (
        <button
          type="button"
          onClick={onCtaClick}
          className="mt-2 px-5 py-2.5 rounded-control bg-brand text-white text-caption font-semibold transition-colors hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
