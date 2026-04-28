import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase
const mockGetUser = vi.fn();
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}));

// Mock rate limiter
const mockCheckRateLimit = vi.fn().mockReturnValue(true);
vi.mock('@/actions/rateLimit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

// Mock global fetch for Google API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/distancematrix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function authenticateUser() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
}

describe('/api/distancematrix route - batched matrix call', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_PLACES_API_KEY = 'test-api-key';
    mockCheckRateLimit.mockReturnValue(true);
    authenticateUser();
  });

  it('makes exactly 1 fetch call for 2 coordinates', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'OK',
          rows: [{ elements: [{ distance: { text: '10 km' }, duration: { text: '15 min' }, status: 'OK' }] }],
        }),
        { status: 200 }
      )
    );

    const { POST } = await import('../../distancematrix/route');
    const req = makeRequest({
      coordinates: [
        { lat: 35.6762, lng: 139.6503 },
        { lat: 34.6937, lng: 135.5023 },
      ],
      mode: 'driving',
    });

    const res = await POST(req);
    const json = await res.json();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(json.segments).toHaveLength(1);
    expect(json.segments[0]).toEqual({ distance: '10 km', duration: '15 min', status: 'OK' });
  });

  it('makes exactly 1 fetch call for 5 coordinates (not 4)', async () => {
    // 5 coords → 4 origins, 4 destinations, but still 1 API call
    const rows = [
      { elements: [
        { distance: { text: '10 km' }, duration: { text: '15 min' }, status: 'OK' },
        { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
        { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
        { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
      ]},
      { elements: [
        { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
        { distance: { text: '20 km' }, duration: { text: '25 min' }, status: 'OK' },
        { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
        { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
      ]},
      { elements: [
        { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
        { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
        { distance: { text: '30 km' }, duration: { text: '35 min' }, status: 'OK' },
        { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
      ]},
      { elements: [
        { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
        { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
        { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
        { distance: { text: '40 km' }, duration: { text: '45 min' }, status: 'OK' },
      ]},
    ];

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'OK', rows }), { status: 200 })
    );

    const { POST } = await import('../../distancematrix/route');
    const req = makeRequest({
      coordinates: [
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
        { lat: 3, lng: 3 },
        { lat: 4, lng: 4 },
        { lat: 5, lng: 5 },
      ],
      mode: 'driving',
    });

    const res = await POST(req);
    const json = await res.json();

    // Only 1 API call, not 4
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // 4 segments from the diagonal
    expect(json.segments).toHaveLength(4);
    expect(json.segments[0]).toEqual({ distance: '10 km', duration: '15 min', status: 'OK' });
    expect(json.segments[1]).toEqual({ distance: '20 km', duration: '25 min', status: 'OK' });
    expect(json.segments[2]).toEqual({ distance: '30 km', duration: '35 min', status: 'OK' });
    expect(json.segments[3]).toEqual({ distance: '40 km', duration: '45 min', status: 'OK' });
  });

  it('sends pipe-separated origins and destinations in the URL', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'OK',
          rows: [
            { elements: [
              { distance: { text: '10 km' }, duration: { text: '15 min' }, status: 'OK' },
              { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
            ]},
            { elements: [
              { distance: { text: 'x' }, duration: { text: 'x' }, status: 'OK' },
              { distance: { text: '20 km' }, duration: { text: '25 min' }, status: 'OK' },
            ]},
          ],
        }),
        { status: 200 }
      )
    );

    const { POST } = await import('../../distancematrix/route');
    const req = makeRequest({
      coordinates: [
        { lat: 1.1, lng: 2.2 },
        { lat: 3.3, lng: 4.4 },
        { lat: 5.5, lng: 6.6 },
      ],
      mode: 'transit',
    });

    await POST(req);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    const url = new URL(calledUrl);
    // origins = coords[0] and coords[1] (pipe-separated)
    expect(url.searchParams.get('origins')).toBe('1.1,2.2|3.3,4.4');
    // destinations = coords[1] and coords[2] (pipe-separated)
    expect(url.searchParams.get('destinations')).toBe('3.3,4.4|5.5,6.6');
    expect(url.searchParams.get('mode')).toBe('transit');
  });

  it('returns same DistanceSegment[] shape for backward compatibility', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'OK',
          rows: [{ elements: [{ distance: { text: '500 km' }, duration: { text: '5 hours' }, status: 'OK' }] }],
        }),
        { status: 200 }
      )
    );

    const { POST } = await import('../../distancematrix/route');
    const req = makeRequest({
      coordinates: [
        { lat: 35.6762, lng: 139.6503 },
        { lat: 34.6937, lng: 135.5023 },
      ],
      mode: 'driving',
    });

    const res = await POST(req);
    const json = await res.json();

    // Verify response shape: { segments: DistanceSegment[] }
    expect(json).toHaveProperty('segments');
    expect(Array.isArray(json.segments)).toBe(true);
    const seg = json.segments[0];
    expect(seg).toHaveProperty('distance');
    expect(seg).toHaveProperty('duration');
    expect(seg).toHaveProperty('status');
  });

  it('returns 401 for unauthenticated users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import('../../distancematrix/route');
    const req = makeRequest({ coordinates: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }], mode: 'driving' });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for fewer than 2 coordinates', async () => {
    const { POST } = await import('../../distancematrix/route');
    const req = makeRequest({ coordinates: [{ lat: 1, lng: 1 }], mode: 'driving' });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 429 when per-user rate limit is exceeded', async () => {
    mockCheckRateLimit.mockReturnValue(false);

    const { POST } = await import('../../distancematrix/route');
    const req = makeRequest({
      coordinates: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }],
      mode: 'driving',
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toMatch(/rate limit/i);
  });

  it('calls checkRateLimit with the authenticated user ID', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'OK',
          rows: [{ elements: [{ distance: { text: '10 km' }, duration: { text: '15 min' }, status: 'OK' }] }],
        }),
        { status: 200 }
      )
    );

    const { POST } = await import('../../distancematrix/route');
    const req = makeRequest({
      coordinates: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }],
      mode: 'driving',
    });

    await POST(req);
    expect(mockCheckRateLimit).toHaveBeenCalledWith('user-1');
  });
});
