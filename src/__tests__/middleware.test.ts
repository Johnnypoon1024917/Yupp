import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/ssr before importing middleware
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set env vars so middleware doesn't throw
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  describe('config.matcher', () => {
    it('exports a matcher config', async () => {
      const { config } = await import('@/middleware');
      expect(config).toBeDefined();
      expect(config.matcher).toBeDefined();
      expect(Array.isArray(config.matcher)).toBe(true);
      expect(config.matcher.length).toBeGreaterThan(0);
    });

    it('matcher pattern contains _next/static exclusion', async () => {
      const { config } = await import('@/middleware');
      const matcherStr = config.matcher[0];
      expect(matcherStr).toContain('_next/static');
    });

    it('matcher pattern contains _next/image exclusion', async () => {
      const { config } = await import('@/middleware');
      const matcherStr = config.matcher[0];
      expect(matcherStr).toContain('_next/image');
    });

    it('matcher excludes favicon.ico', async () => {
      const { config } = await import('@/middleware');
      const pattern = new RegExp(config.matcher[0]);
      expect(pattern.test('/favicon.ico')).toBe(false);
    });

    it('matcher excludes image extensions', async () => {
      const { config } = await import('@/middleware');
      const pattern = new RegExp(config.matcher[0]);
      expect(pattern.test('/images/photo.png')).toBe(false);
      expect(pattern.test('/images/photo.jpg')).toBe(false);
      expect(pattern.test('/images/photo.jpeg')).toBe(false);
      expect(pattern.test('/logo.svg')).toBe(false);
      expect(pattern.test('/banner.gif')).toBe(false);
      expect(pattern.test('/hero.webp')).toBe(false);
    });

    it('matcher includes normal routes', async () => {
      const { config } = await import('@/middleware');
      const pattern = new RegExp(config.matcher[0]);
      expect(pattern.test('/')).toBe(true);
      expect(pattern.test('/dashboard')).toBe(true);
      expect(pattern.test('/api/data')).toBe(true);
    });
  });

  describe('middleware function', () => {
    it('calls supabase.auth.getUser to refresh session', async () => {
      const { createServerClient } = await import('@supabase/ssr');
      const { middleware } = await import('@/middleware');

      const mockRequest = {
        nextUrl: { pathname: '/' },
        cookies: {
          getAll: vi.fn().mockReturnValue([]),
          set: vi.fn(),
        },
      };

      await middleware(mockRequest as never);

      expect(createServerClient).toHaveBeenCalled();
      expect(mockGetUser).toHaveBeenCalled();
    });
  });
});
