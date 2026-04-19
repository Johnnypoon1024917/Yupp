import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @supabase/ssr to avoid actual client creation
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({ auth: {} })),
}));

describe('env var validation — client.ts', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    // Reset module registry so createClient re-reads env vars
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env vars
    if (originalUrl !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (originalKey !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
  });

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

    const { createClient } = await import('@/utils/supabase/client');
    expect(() => createClient()).toThrow('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  });

  it('throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { createClient } = await import('@/utils/supabase/client');
    expect(() => createClient()).toThrow('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  });

  it('does not throw when both env vars are set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

    const { createClient } = await import('@/utils/supabase/client');
    expect(() => createClient()).not.toThrow();
  });

  it('throws when both env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { createClient } = await import('@/utils/supabase/client');
    expect(() => createClient()).toThrow('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  });
});
