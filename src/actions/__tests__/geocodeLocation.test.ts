import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to import after setting up the environment
import { geocodeLocation } from '../geocodeLocation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlacesResponse(places: Array<Record<string, unknown>>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ places }),
  } as unknown as Response;
}

function emptyPlacesResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ places: [] }),
  } as unknown as Response;
}

describe('geocodeLocation — example-based tests', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalApiKey = process.env.GOOGLE_PLACES_API_KEY;
    process.env.GOOGLE_PLACES_API_KEY = 'test-api-key';
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey !== undefined) {
      process.env.GOOGLE_PLACES_API_KEY = originalApiKey;
    } else {
      delete process.env.GOOGLE_PLACES_API_KEY;
    }
  });

  // -----------------------------------------------------------------------
  // Req 3.2 — address populated from formattedAddress
  // -----------------------------------------------------------------------
  it('populates address from formattedAddress (Req 3.2)', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce(
      makePlacesResponse([
        {
          id: 'place-1',
          displayName: { text: 'Tanah Lot', languageCode: 'en' },
          formattedAddress: 'Beraban, Kediri, Tabanan Regency, Bali, Indonesia',
          location: { latitude: -8.6213, longitude: 115.0868 },
          primaryType: 'tourist_attraction',
          rating: 4.6,
          userRatingCount: 12000,
        },
      ]),
    );

    const result = await geocodeLocation({ location: 'Tanah Lot' });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.address).toBe('Beraban, Kediri, Tabanan Regency, Bali, Indonesia');
    }
  });

  // -----------------------------------------------------------------------
  // Req 3.3 — address falls back to displayName.text when formattedAddress
  //           is missing
  // -----------------------------------------------------------------------
  it('falls back to displayName.text when formattedAddress is missing (Req 3.3)', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce(
      makePlacesResponse([
        {
          id: 'place-2',
          displayName: { text: 'Secret Beach Spot', languageCode: 'en' },
          // formattedAddress intentionally omitted
          location: { latitude: -8.5, longitude: 115.2 },
          primaryType: 'beach',
          rating: 4.5,
          userRatingCount: 100,
        },
      ]),
    );

    const result = await geocodeLocation({ location: 'Secret Beach Spot' });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.address).toBe('Secret Beach Spot');
    }
  });

  // -----------------------------------------------------------------------
  // Req 4.3 — zero results → needs_user_input
  // -----------------------------------------------------------------------
  it('returns needs_user_input when zero results are returned (Req 4.3)', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce(emptyPlacesResponse());

    const partialData = { title: 'Unknown Place', imageUrl: 'https://img.example.com/pic.jpg' };
    const result = await geocodeLocation({
      location: 'xyznonexistent12345',
      partialData,
    });

    expect(result.status).toBe('needs_user_input');
    if (result.status === 'needs_user_input') {
      expect(result.partialData).toEqual(partialData);
    }
  });

  // -----------------------------------------------------------------------
  // Req 5.1 — FIELD_MASK includes places.userRatingCount
  // -----------------------------------------------------------------------
  it('sends places.userRatingCount in the X-Goog-FieldMask header (Req 5.1)', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce(
      makePlacesResponse([
        {
          id: 'place-3',
          displayName: { text: 'Test Cafe', languageCode: 'en' },
          formattedAddress: '1 Test St',
          location: { latitude: 0, longitude: 0 },
          rating: 4.0,
          userRatingCount: 30,
        },
      ]),
    );

    await geocodeLocation({ location: 'Test Cafe' });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [, fetchOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = fetchOptions.headers as Record<string, string>;
    expect(headers['X-Goog-FieldMask']).toContain('places.userRatingCount');
  });
});
