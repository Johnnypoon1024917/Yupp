'use server';

import { GeocodeResult } from '@/types';

const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = 'places.location,places.displayName,places.formattedAddress,places.primaryType,places.rating,places.id';
const TIMEOUT_MS = 10_000;

interface GooglePlacesResponse {
  places?: Array<{
    id: string;
    displayName: { text: string; languageCode: string };
    formattedAddress?: string;
    location: { latitude: number; longitude: number };
    primaryType?: string;
    rating?: number;
  }>;
}

type GooglePlace = NonNullable<GooglePlacesResponse['places']>[number];

/**
 * Prominence Picking — resolve multi-result ambiguity without human fallback.
 *
 * Strategy:
 * 1. If the top result has a high rating (> 4.0), it's likely the canonical match.
 * 2. If a result's displayName contains any contextual hint (e.g. "Hong Kong"),
 *    it's a strong signal of relevance.
 * 3. If the top two results share the same name AND are in the same city-level
 *    area (lat/lng within ~0.05°), they're truly ambiguous → return null.
 * 4. Otherwise, the first result wins (Google's own ranking is a strong signal).
 */
function pickProminentPlace(
  places: GooglePlace[],
  contextualHints?: string[],
): GooglePlace | null {
  if (places.length === 0) return null;
  if (places.length === 1) return places[0];

  const first = places[0];
  const second = places[1];

  // Check for true ambiguity: same name + geographically close
  const sameName =
    first.displayName.text.toLowerCase() === second.displayName.text.toLowerCase();
  const latDiff = Math.abs(first.location.latitude - second.location.latitude);
  const lngDiff = Math.abs(first.location.longitude - second.location.longitude);
  const geographicallyClose = latDiff < 0.05 && lngDiff < 0.05;

  if (sameName && geographicallyClose) {
    // Genuinely ambiguous — two places with the same name in the same area
    return null;
  }

  // Contextual hint match — boost any result whose name contains a hint
  if (contextualHints && contextualHints.length > 0) {
    const hintsLower = contextualHints.map((h) => h.toLowerCase());
    for (const place of places) {
      const nameLower = place.displayName.text.toLowerCase();
      if (hintsLower.some((hint) => nameLower.includes(hint))) {
        console.log('[pickProminentPlace] Contextual hint match:', place.displayName.text);
        return place;
      }
    }
  }

  // High-rating first result is a strong prominence signal
  if (first.rating != null && first.rating > 4.0) {
    console.log('[pickProminentPlace] High-rating first result:', first.displayName.text, first.rating);
    return first;
  }

  // Default: trust Google's ranking — the first result is the most relevant
  console.log('[pickProminentPlace] Defaulting to first result:', first.displayName.text);
  return first;
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

    if (places.length === 0) {
      return {
        status: 'needs_user_input',
        partialData: partialData ?? { title: '', imageUrl: null },
      };
    }

    // --- Prominence Picking ---
    // For a single result, accept it directly.
    // For multiple results, try to pick a clear winner before falling back to human input.
    const winner = pickProminentPlace(places, contextualHints);

    if (winner) {
      return {
        status: 'success',
        lat: winner.location.latitude,
        lng: winner.location.longitude,
        displayName: winner.formattedAddress || winner.displayName.text,
        enrichedData: {
          placeId: winner.id,
          primaryType: winner.primaryType,
          rating: winner.rating,
        },
      };
    }

    // Truly ambiguous — ask the human.
    console.log('[geocodeLocation] Results are ambiguous, requesting user input');
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
