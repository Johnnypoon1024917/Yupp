interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

export const WINDOW_MS = 60_000; // 1 minute
export const MAX_REQUESTS = 20;

/**
 * Fixed-window rate limiter. Returns true if the request is allowed,
 * false if the IP has exceeded MAX_REQUESTS within the current window.
 * Automatically resets the window when it expires.
 */
export function checkRateLimit(ip: string): boolean {
  const key = ip || 'unknown';
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // New window — reset and allow
    store.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count < MAX_REQUESTS) {
    entry.count++;
    return true;
  }

  return false;
}

/** Clears all rate limit state. Exported for testing only. */
export function _resetStore(): void {
  store.clear();
}
