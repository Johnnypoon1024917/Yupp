'use server';

import { GeocodeResult } from '@/types';

const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = 'places.location,places.displayName,places.primaryType,places.rating,places.id';
const TIMEOUT_MS = 10_000;

interface GooglePlacesResponse {
  places?: Array<{
    id: string;
    displayName: { text: string; languageCode: string };
    location: { latitude: number; longitude: number };
    primaryType?: string;
    rating?: number;
  }>;
}

export async function geocodeLocation(input: {
  location: string;
  contextualHints?: string[];
  partialData?: { title: string; imageUrl: string | null };
}): Promise<GeocodeResult> {
  const { location, contextualHints, partialData } = input;

  console.log('[geocodeLocation] Called with:', { location, contextualHints, partialData: !!partialData });

  if (!location || location.trim().length === 0) {
    return { status: 'error', error: 'Location string is empty' };
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return { status: 'error', error: 'GOOGLE_PLACES_API_KEY is not configured' };
  }

  const textQuery =
    contextualHints && contextualHints.length > 0
      ? `${location}, ${contextualHints[0]}`
      : location;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GOOGLE_PLACES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({ textQuery }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { status: 'error', error: `Google Places API returned status ${response.status}` };
    }

    const data: GooglePlacesResponse = await response.json();
    const places = data.places ?? [];

    console.log('[geocodeLocation] Google Places returned', places.length, 'results for query:', textQuery);

    if (places.length === 1) {
      const place = places[0];
      return {
        status: 'success',
        lat: place.location.latitude,
        lng: place.location.longitude,
        displayName: place.displayName.text,
        enrichedData: {
          placeId: place.id,
          primaryType: place.primaryType,
          rating: place.rating,
        },
      };
    }

    return {
      status: 'needs_user_input',
      partialData: partialData ?? { title: '', imageUrl: null },
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === 'AbortError') {
      return { status: 'error', error: 'Google Places request timed out after 10 seconds' };
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return { status: 'error', error: `Geocoding failed: ${message}` };
  }
}
