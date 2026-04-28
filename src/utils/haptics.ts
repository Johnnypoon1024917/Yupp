import { getReducedMotion } from './motion';

export interface HapticsAPI {
  tap: () => void;
  success: () => void;
  error: () => void;
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined') return;
  if (getReducedMotion()) return;
  navigator.vibrate?.(pattern);
}

export const haptics: HapticsAPI = {
  tap: () => vibrate(10),
  success: () => vibrate([10, 50, 10]),
  error: () => vibrate([50, 30, 50]),
};
