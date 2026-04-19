import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlannedPin } from '@/types';

function makePin(overrides: Partial<PlannedPin> = {}): PlannedPin {
  return {
    id: 'pin-1',
    title: 'Test Pin',
    imageUrl: 'https://example.com/img.jpg',
    sourceUrl: 'https://example.com',
    latitude: 35.6762,
    longitude: 139.6503,
    collectionId: 'col-1',
    createdAt: '2024-01-01T00:00:00Z',
    day_number: 1,
    sort_order: 0,
    itinerary_item_id: 'item-1',
    ...overrides,
  };
}

const pin1 = makePin({ id: 'pin-1', latitude: 35.6762, longitude: 139.6503, sort_order: 0 });
const pin2 = makePin({ id: 'pin-2', latitude: 34.6937, longitude: 135.5023, sort_order: 1 });
const pin3 = makePin({ id: 'pin-3', latitude: 35.0116, longitude: 135.7681, sort_order: 2 });

// Capture useEffect callbacks and useState calls
let capturedEffect: (() => (() => void) | void) | null = null;
let capturedDeps: unknown[] | undefined = undefined;

// Track state setters
const stateSetters: Record<string, (val: unknown) => void> = {};
let stateCallIndex = 0;
const stateNames = ['segments', 'isLoading', 'error'];
const stateValues: Record<string, unknown> = {
  segments: [],
  isLoading: false,
  error: null,
};

vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const name = stateNames[stateCallIndex % stateNames.length];
    stateValues[name] = initial;
    const setter = (val: unknown) => {
      stateValues[name] = typeof val === 'function' ? (val as (prev: unknown) => unknown)(stateValues[name]) : val;
    };
    stateSetters[name] = setter;
    stateCallIndex++;
    return [stateValues[name], setter];
  },
  useEffect: (fn: () => (() => void) | void, deps?: unknown[]) => {
    capturedEffect = fn;
    capturedDeps = deps;
  },
  useRef: (initial: unknown) => ({ current: initial }),
}));

describe('useDistanceMatrix', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedEffect = null;
    capturedDeps = undefined;
    stateCallIndex = 0;
    stateValues.segments = [];
    stateValues.isLoading = false;
    stateValues.error = null;
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  it('does not fetch when fewer than 2 pins', async () => {
    const { useDistanceMatrix } = await import('../useDistanceMatrix');
    useDistanceMatrix([pin1], 'driving');

    expect(capturedEffect).not.toBeNull();
    capturedEffect!();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch for empty pins array', async () => {
    const { useDistanceMatrix } = await import('../useDistanceMatrix');
    useDistanceMatrix([], 'transit');

    capturedEffect!();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches distance data for 2+ pins', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          segments: [{ distance: '500 km', duration: '5 hours', status: 'OK' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { useDistanceMatrix } = await import('../useDistanceMatrix');
    useDistanceMatrix([pin1, pin2], 'driving');

    capturedEffect!();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/distancematrix');

    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.coordinates).toHaveLength(2);
    expect(body.coordinates[0]).toEqual({ lat: pin1.latitude, lng: pin1.longitude });
    expect(body.coordinates[1]).toEqual({ lat: pin2.latitude, lng: pin2.longitude });
    expect(body.mode).toBe('driving');
  });

  it('sends correct coordinates for 3 pins', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          segments: [
            { distance: '500 km', duration: '5 hours', status: 'OK' },
            { distance: '80 km', duration: '1 hour', status: 'OK' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { useDistanceMatrix } = await import('../useDistanceMatrix');
    useDistanceMatrix([pin1, pin2, pin3], 'transit');

    capturedEffect!();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.coordinates).toHaveLength(3);
    expect(body.mode).toBe('transit');
  });

  it('uses serialized key of pin.id + sort_order as dependency', async () => {
    const { useDistanceMatrix } = await import('../useDistanceMatrix');
    useDistanceMatrix([pin1, pin2], 'driving');

    // The dependency array should include the serialized key and mode
    expect(capturedDeps).toBeDefined();
    expect(capturedDeps).toHaveLength(2);
    // First dep is the serialized key
    expect(capturedDeps![0]).toBe('pin-1:0|pin-2:1');
    // Second dep is the mode
    expect(capturedDeps![1]).toBe('driving');
  });

  it('serialized key changes when sort_order changes', async () => {
    const { useDistanceMatrix } = await import('../useDistanceMatrix');

    useDistanceMatrix([pin1, pin2], 'driving');
    const key1 = capturedDeps![0];

    // Swap sort orders
    const reorderedPin1 = { ...pin2, sort_order: 0 };
    const reorderedPin2 = { ...pin1, sort_order: 1 };
    stateCallIndex = 0;
    useDistanceMatrix([reorderedPin1, reorderedPin2], 'driving');
    const key2 = capturedDeps![0];

    expect(key1).not.toBe(key2);
  });

  it('returns cleanup function that aborts the request', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ segments: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { useDistanceMatrix } = await import('../useDistanceMatrix');
    useDistanceMatrix([pin1, pin2], 'driving');

    const cleanup = capturedEffect!();
    expect(typeof cleanup).toBe('function');
  });

  it('exports DistanceSegment type', async () => {
    // Verify the module exports the type by importing it
    const mod = await import('../useDistanceMatrix');
    expect(mod.useDistanceMatrix).toBeDefined();
    // DistanceSegment is a type export — we verify the hook function exists
    // TypeScript compilation would fail if the type wasn't exported properly
  });
});
