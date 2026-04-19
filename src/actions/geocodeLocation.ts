'use server';

import { GeocodeResult, GeocodeError } from '@/types';

// --- Geocoder Configuration ---

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'TravelPinBoard/1.0';
const TIMEOUT_MS = 10000;
const MIN_REQUEST_INTERVAL_MS = 1000;

// --- Rate Limiting ---

let lastRequestTimestamp = 0;

async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTimestamp;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const waitMs = MIN_REQUEST_INTERVAL_MS - elapsed;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastRequestTimestamp = Date.now();
}

// --- Nominatim Types ---

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  importance: number;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
}

// --- Core Nominatim Query ---

async function queryNominatim(
  query: string,
  viewbox?: string
): Promise<NominatimResult[]> {
  await enforceRateLimit();

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
  });

  if (viewbox) {
    params.set('viewbox', viewbox);
    params.set('bounded', '0');
  }

  const url = `${NOMINATIM_BASE_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Nominatim returned status ${response.status}`);
    }

    const data: NominatimResult[] = await response.json();
    return data;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Nominatim request timed out after 10 seconds');
    }
    throw error;
  }
}

// --- Viewbox Biasing ---

async function getViewboxFromHints(
  hints: string[]
): Promise<string | undefined> {
  // Geocode the first hint to get a rough bounding box
  const hintQuery = hints.join(', ');
  try {
    const results = await queryNominatim(hintQuery);
    if (results.length > 0) {
      const [south, north, west, east] = results[0].boundingbox;
      // viewbox format: west,south,east,north (lon1,lat1,lon2,lat2)
      return `${west},${south},${east},${north}`;
    }
  } catch (error) {
    console.warn('Failed to geocode contextual hint:', hintQuery, error);
  }
  return undefined;
}

// --- Select Best Result ---

function selectBestResult(results: NominatimResult[]): NominatimResult {
  // Sort by importance descending
  const sorted = [...results].sort((a, b) => b.importance - a.importance);
  const best = sorted[0];

  // Log alternatives
  if (sorted.length > 1) {
    console.log(
      `Geocode: Selected "${best.display_name}" (importance: ${best.importance}). Alternatives:`
    );
    sorted.slice(1).forEach((alt) => {
      console.log(
        `  - "${alt.display_name}" (importance: ${alt.importance})`
      );
    });
  }

  return best;
}

// --- Main Exported Function ---

export async function geocodeLocation(input: {
  location: string;
  contextualHints?: string[];
}): Promise<GeocodeResult | GeocodeError> {
  const { location, contextualHints } = input;

  if (!location || location.trim().length === 0) {
    return { success: false, error: 'Location string is empty' };
  }

  try {
    // Build viewbox from contextual hints if provided
    let viewbox: string | undefined;
    if (contextualHints && contextualHints.length > 0) {
      viewbox = await getViewboxFromHints(contextualHints);
    }

    // Query Nominatim for the primary location
    const results = await queryNominatim(location.trim(), viewbox);

    if (results.length === 0) {
      return {
        success: false,
        error: `Could not geocode location: "${location}". No results found.`,
      };
    }

    const best = selectBestResult(results);

    return {
      success: true,
      lat: parseFloat(best.lat),
      lng: parseFloat(best.lon),
      displayName: best.display_name,
      importance: best.importance,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown geocoding error';
    return {
      success: false,
      error: `Geocoding failed: ${message}`,
    };
  }
}
