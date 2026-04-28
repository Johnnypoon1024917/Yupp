'use client';

/** LibraryPane empty state — a map pin with a soft halo. */
export default function PinIllustration() {
  return (
    <svg
      width="128"
      height="128"
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Soft halo */}
      <circle cx="64" cy="58" r="40" fill="var(--color-brand-soft)" opacity="0.5" />
      {/* Pin body */}
      <path
        d="M64 20C51.85 20 42 29.85 42 42C42 57.5 64 84 64 84C64 84 86 57.5 86 42C86 29.85 76.15 20 64 20Z"
        fill="var(--color-brand)"
      />
      {/* Inner circle */}
      <circle cx="64" cy="42" r="10" fill="white" />
      {/* Tiny heart / star inside pin */}
      <circle cx="64" cy="42" r="4" fill="var(--color-brand)" />
      {/* Shadow ellipse */}
      <ellipse
        cx="64"
        cy="104"
        rx="18"
        ry="4"
        fill="var(--color-ink-3)"
        opacity="0.25"
      />
    </svg>
  );
}
