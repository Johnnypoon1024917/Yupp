'use client';

/** Home Surface empty state — stylised map with a pin marker. */
export default function MapIllustration() {
  return (
    <svg
      width="128"
      height="128"
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Folded map background */}
      <rect
        x="16"
        y="28"
        width="96"
        height="72"
        rx="8"
        fill="var(--color-brand-soft)"
      />
      {/* Map fold lines */}
      <line
        x1="48"
        y1="28"
        x2="48"
        y2="100"
        stroke="var(--color-ink-3)"
        strokeWidth="1"
        strokeDasharray="4 3"
        opacity="0.5"
      />
      <line
        x1="80"
        y1="28"
        x2="80"
        y2="100"
        stroke="var(--color-ink-3)"
        strokeWidth="1"
        strokeDasharray="4 3"
        opacity="0.5"
      />
      <line
        x1="16"
        y1="64"
        x2="112"
        y2="64"
        stroke="var(--color-ink-3)"
        strokeWidth="1"
        strokeDasharray="4 3"
        opacity="0.5"
      />
      {/* Pin marker */}
      <path
        d="M64 36C56.268 36 50 42.268 50 50C50 60 64 76 64 76C64 76 78 60 78 50C78 42.268 71.732 36 64 36Z"
        fill="var(--color-brand)"
      />
      <circle cx="64" cy="50" r="6" fill="white" />
    </svg>
  );
}
