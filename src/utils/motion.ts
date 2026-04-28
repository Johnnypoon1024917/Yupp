// Duration constants (seconds)
export const DURATION_FAST = 0.15;
export const DURATION_BASE = 0.25;
export const DURATION_SLOW = 0.4;

// Easing definitions
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_IN: [number, number, number, number] = [0.4, 0, 1, 1];
export const EASE_SPRING = { type: 'spring' as const, stiffness: 400, damping: 30 };

// Reusable framer-motion transition presets
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: DURATION_BASE, ease: EASE_OUT },
};

export const slideUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION_BASE, ease: EASE_OUT },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: DURATION_FAST, ease: EASE_OUT },
};

// SSR-safe reduced-motion detection
export function getReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Reduced-motion transition override
export const reducedTransition = { duration: 0, ease: 'linear' as const };
