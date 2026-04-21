export interface Pin {
  id: string;            // UUID v4
  title: string;         // Clean place/venue name
  description?: string;  // Caption or body text from source
  imageUrl: string;      // From og:image or placeholder identifier
  sourceUrl: string;     // Original pasted URL
  latitude: number;      // From geocoder
  longitude: number;     // From geocoder
  collectionId: string;  // Defaults to "unorganized"
  createdAt: string;     // ISO 8601 timestamp
  placeId?: string;      // Google Places unique identifier
  primaryType?: string;  // Place type (e.g., "restaurant")
  rating?: number;       // Google rating (1.0–5.0)
  address?: string;      // Human-readable location from geocoder displayName
  user_id?: string;      // Set when persisted to cloud
}

export interface Collection {
  id: string;            // UUID v4 or "unorganized" for default
  name: string;          // User-defined or "Unorganized"
  createdAt: string;     // ISO 8601 timestamp
  user_id?: string;      // Set when persisted to cloud
  isPublic?: boolean;    // Maps to is_public column in DB
}

export interface ExtractedPlace {
  name: string;
  contextualHints: string[];
}

export type Platform = 'instagram' | 'douyin' | 'xiaohongshu' | 'unknown';

export interface ScrapeResult {
  success: true;
  title: string;
  description: string | null; // Caption/body text split from title
  imageUrl: string | null; // null → use placeholder
  sourceUrl: string;
  platform: Platform;
  extractedPlaces: ExtractedPlace[]; // replaces location + contextualHints
}

export interface ScrapeError {
  success: false;
  error: string;
}

export interface EnrichedData {
  placeId: string;
  primaryType?: string;
  rating?: number;
}

export type GeocodeResult =
  | { status: 'success'; lat: number; lng: number; displayName: string; address: string; enrichedData: EnrichedData }
  | { status: 'needs_user_input'; partialData: { title: string; imageUrl: string | null } }
  | { status: 'error'; error: string };

export interface Itinerary {
  id: string;
  userId: string;
  name: string;
  tripDate: string | null;
  createdAt: string;
}

export interface ItineraryItem {
  id: string;
  itineraryId: string;
  pinId: string;
  dayNumber: number;
  sortOrder: number;
  createdAt: string;
}

/** A Pin enriched with its placement in an itinerary day. */
export type PlannedPin = Pin & {
  day_number: number;
  sort_order: number;
  itinerary_item_id: string;
};

/** Data shape for a publicly shared trip, used by the Public Trip Page. */
export interface PublicTripData {
  itinerary: Itinerary & { isPublic: boolean };
  plannedPins: PlannedPin[];
}
