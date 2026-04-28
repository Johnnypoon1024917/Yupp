'use client';

/** DiscoverFeed empty state — compass rose illustration. */
export default function CompassIllustration() {
  return (
    <svg
      width="128"
      height="128"
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer ring */}
      <circle
        cx="64"
        cy="64"
        r="48"
        stroke="var(--color-brand-soft)"
        strokeWidth="4"
        fill="none"
      />
      {/* Inner ring */}
      <circle
        cx="64"
        cy="64"
        r="36"
        stroke="var(--color-ink-3)"
        strokeWidth="1.5"
        fill="none"
        opacity="0.4"
      />
      {/* North needle */}
      <polygon
        points="64,24 58,64 64,56 70,64"
        fill="var(--color-brand)"
      />
      {/* South needle */}
      <polygon
        points="64,104 58,64 64,72 70,64"
        fill="var(--color-ink-3)"
        opacity="0.5"
      />
      {/* East needle */}
      <polygon
        points="104,64 64,58 72,64 64,70"
        fill="var(--color-ink-3)"
        opacity="0.5"
      />
      {/* West needle */}
      <polygon
        points="24,64 64,58 56,64 64,70"
        fill="var(--color-ink-3)"
        opacity="0.5"
      />
      {/* Center dot */}
      <circle cx="64" cy="64" r="4" fill="var(--color-brand)" />
    </svg>
  );
}
