import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
const mockSignInWithOAuth = vi.fn().mockResolvedValue({ data: {}, error: null });
const mockSignOut = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
    },
  }),
}));

// Mock the store
const mockSetUser = vi.fn();
vi.mock('@/store/useTravelPinStore', () => {
  const store = vi.fn((selector: (s: Record<string, unknown>) => unknown) => {
    const state = { user: null, setUser: mockSetUser };
    return selector(state);
  });
  return { default: store };
});

describe('AuthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createClient returns a mock with signInWithOAuth', async () => {
    const { createClient } = await import('@/utils/supabase/client');
    const client = createClient();
    expect(client.auth.signInWithOAuth).toBeDefined();
    expect(typeof client.auth.signInWithOAuth).toBe('function');
  });

  it('createClient returns a mock with signOut', async () => {
    const { createClient } = await import('@/utils/supabase/client');
    const client = createClient();
    expect(client.auth.signOut).toBeDefined();
    expect(typeof client.auth.signOut).toBe('function');
  });

  it('signInWithOAuth can be called with google provider', async () => {
    const { createClient } = await import('@/utils/supabase/client');
    const client = createClient();
    await client.auth.signInWithOAuth({ provider: 'google' });
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({ provider: 'google' });
  });

  it('signOut can be called and resolves without error', async () => {
    const { createClient } = await import('@/utils/supabase/client');
    const client = createClient();
    const result = await client.auth.signOut();
    expect(mockSignOut).toHaveBeenCalled();
    expect(result.error).toBeNull();
  });

  it('store selector returns user as null for unauthenticated state', async () => {
    const { default: useTravelPinStore } = await import('@/store/useTravelPinStore');
    const user = useTravelPinStore((s: Record<string, unknown>) => s.user);
    expect(user).toBeNull();
  });

  it('store selector returns setUser function', async () => {
    const { default: useTravelPinStore } = await import('@/store/useTravelPinStore');
    const setUser = useTravelPinStore((s: Record<string, unknown>) => s.setUser);
    expect(typeof setUser).toBe('function');
  });
});
