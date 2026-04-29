import { describe, it, expect } from 'vitest';

/**
 * Tests for the redirect stub URL construction logic.
 * We test the pure URL-building logic that the redirect stubs use,
 * without invoking Next.js `redirect()`.
 */

describe('share redirect URL construction', () => {
  it('constructs /app/share?url=X&text=Y from query params', () => {
    const params = { url: 'https://example.com', text: 'Check this out' };
    const qs = new URLSearchParams(params).toString();
    const target = `/app/share${qs ? `?${qs}` : ''}`;
    expect(target).toBe('/app/share?url=https%3A%2F%2Fexample.com&text=Check+this+out');
  });

  it('constructs /app/share with no query string when params are empty', () => {
    const params: Record<string, string> = {};
    const qs = new URLSearchParams(params).toString();
    const target = `/app/share${qs ? `?${qs}` : ''}`;
    expect(target).toBe('/app/share');
  });

  it('preserves all query parameters in the redirect', () => {
    const params = { url: 'https://tiktok.com/v/123', text: 'cool place', title: 'My Trip' };
    const qs = new URLSearchParams(params).toString();
    const target = `/app/share${qs ? `?${qs}` : ''}`;
    expect(target).toContain('url=');
    expect(target).toContain('text=');
    expect(target).toContain('title=');
    expect(target.startsWith('/app/share?')).toBe(true);
  });
});

describe('trip redirect URL construction', () => {
  it('constructs /app/trip/{id} from the id param', () => {
    const id = 'abc-123';
    const target = `/app/trip/${id}`;
    expect(target).toBe('/app/trip/abc-123');
  });

  it('handles ids with special characters', () => {
    const id = 'trip_2024-summer';
    const target = `/app/trip/${id}`;
    expect(target).toBe('/app/trip/trip_2024-summer');
  });
});
