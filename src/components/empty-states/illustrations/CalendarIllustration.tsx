'use client';

/** TripTimeline empty state — calendar page with a pin accent. */
export default function CalendarIllustration() {
  return (
    <svg
      width="128"
      height="128"
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Calendar body */}
      <rect
        x="24"
        y="32"
        width="80"
        height="76"
        rx="8"
        fill="var(--color-brand-soft)"
      />
      {/* Calendar header bar */}
      <rect
        x="24"
        y="32"
        width="80"
        height="20"
        rx="8"
        fill="var(--color-brand)"
      />
      {/* Binding rings */}
      <rect x="44" y="24" width="4" height="16" rx="2" fill="var(--color-ink-3)" />
      <rect x="80" y="24" width="4" height="16" rx="2" fill="var(--color-ink-3)" />
      {/* Grid dots representing days */}
      <circle cx="44" cy="68" r="3" fill="var(--color-ink-3)" opacity="0.3" />
      <circle cx="58" cy="68" r="3" fill="var(--color-ink-3)" opacity="0.3" />
      <circle cx="72" cy="68" r="3" fill="var(--color-ink-3)" opacity="0.3" />
      <circle cx="86" cy="68" r="3" fill="var(--color-ink-3)" opacity="0.3" />
      <circle cx="44" cy="84" r="3" fill="var(--color-ink-3)" opacity="0.3" />
      <circle cx="58" cy="84" r="3" fill="var(--color-ink-3)" opacity="0.3" />
      {/* Highlighted day */}
      <circle cx="72" cy="84" r="5" fill="var(--color-brand)" />
      <circle cx="86" cy="84" r="3" fill="var(--color-ink-3)" opacity="0.3" />
      <circle cx="44" cy="100" r="3" fill="var(--color-ink-3)" opacity="0.3" />
      <circle cx="58" cy="100" r="3" fill="var(--color-ink-3)" opacity="0.3" />
    </svg>
  );
}
