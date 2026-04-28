import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
const mockUnsubscribe = vi.fn();
const mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: mockUnsubscribe } },
});
const mockGetSession = vi.fn().mockResolvedValue({
  data: { session: null },
});

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      getSession: mockGetSession,
      signInAnonymously: vi.fn().mockResolvedValue({
        data: { user: { id: 'anon-user-123' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  }),
}));

// We need to mock React's useEffect to capture the callback
let capturedEffect: (() => (() => void) | void) | null = null;
vi.mock('react', () => ({
  useEffect: (fn: () => (() => void) | void) => {
    capturedEffect = fn;
  },
}));

describe('useCloudSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEffect = null;
  });

  it('subscribes to onAuthStateChange when effect runs', async () => {
    const { default: useCloudSync } = await import('@/hooks/useCloudSync');
    useCloudSync();

    expect(capturedEffect).not.toBeNull();
    const cleanup = capturedEffect!();

    expect(mockOnAuthStateChange).toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');
  });

  it('checks for existing session on mount', async () => {
    const { default: useCloudSync } = await import('@/hooks/useCloudSync');
    useCloudSync();
    capturedEffect!();

    expect(mockGetSession).toHaveBeenCalled();
  });

  it('cleanup function calls unsubscribe', async () => {
    const { default: useCloudSync } = await import('@/hooks/useCloudSync');
    useCloudSync();
    const cleanup = capturedEffect!() as () => void;

    cleanup();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('SIGNED_OUT handler calls setUser(null)', async () => {
    const useTravelPinStore = (await import('@/store/useTravelPinStore')).default;
    const setUserSpy = vi.fn();
    useTravelPinStore.setState({ user: { id: 'u1' } as never });
    const originalGetState = useTravelPinStore.getState;
    vi.spyOn(useTravelPinStore, 'getState').mockImplementation(() => ({
      ...originalGetState(),
      setUser: setUserSpy,
      setCloudData: vi.fn(),
    }));

    const { default: useCloudSync } = await import('@/hooks/useCloudSync');
    useCloudSync();
    capturedEffect!();

    // Get the callback passed to onAuthStateChange
    const authCallback = mockOnAuthStateChange.mock.calls[0][0];
    await authCallback('SIGNED_OUT', null);

    expect(setUserSpy).toHaveBeenCalledWith(null);

    vi.restoreAllMocks();
  });
});

describe('useCloudSync pure helpers', () => {
  it('getLocalData returns items without user_id', async () => {
    const { getLocalData } = await import('@/hooks/useCloudSync');

    const pins = [
      { id: '1', title: 'Local', imageUrl: '', sourceUrl: '', latitude: 0, longitude: 0, collectionId: 'c1', createdAt: '' },
      { id: '2', title: 'Cloud', imageUrl: '', sourceUrl: '', latitude: 0, longitude: 0, collectionId: 'c1', createdAt: '', user_id: 'u1' },
    ];
    const collections = [
      { id: 'c1', name: 'Local Col', createdAt: '' },
      { id: 'c2', name: 'Cloud Col', createdAt: '', user_id: 'u1' },
    ];

    const result = getLocalData(pins, collections);
    expect(result.localPins).toHaveLength(1);
    expect(result.localPins[0].id).toBe('1');
    expect(result.localCollections).toHaveLength(1);
    expect(result.localCollections[0].id).toBe('c1');
  });

  it('buildCollectionIdMap creates correct mapping', async () => {
    const { buildCollectionIdMap } = await import('@/hooks/useCloudSync');

    const localCollections = [
      { id: 'local-1', name: 'A', createdAt: '' },
      { id: 'local-2', name: 'B', createdAt: '' },
    ];
    const cloudCollections = [{ id: 'cloud-1', name: 'A' }, { id: 'cloud-2', name: 'B' }];

    const map = buildCollectionIdMap(localCollections, cloudCollections);
    expect(map.size).toBe(2);
    expect(map.get('local-1')).toBe('cloud-1');
    expect(map.get('local-2')).toBe('cloud-2');
  });

  it('remapPinCollectionIds replaces mapped IDs and falls back to unorganized', async () => {
    const { remapPinCollectionIds } = await import('@/hooks/useCloudSync');

    const pins = [
      { id: 'p1', title: 'A', imageUrl: '', sourceUrl: '', latitude: 0, longitude: 0, collectionId: 'local-1', createdAt: '' },
      { id: 'p2', title: 'B', imageUrl: '', sourceUrl: '', latitude: 0, longitude: 0, collectionId: 'unknown', createdAt: '' },
    ];
    const idMap = new Map([['local-1', 'cloud-1']]);

    const result = remapPinCollectionIds(pins, idMap, 'cloud-unorganized');
    expect(result[0].collectionId).toBe('cloud-1');
    expect(result[1].collectionId).toBe('cloud-unorganized');
  });
});
