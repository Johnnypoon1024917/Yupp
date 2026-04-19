export interface Pin {
  id: string;            // UUID v4
  title: string;         // From og:title or <title>
  imageUrl: string;      // From og:image or placeholder identifier
  sourceUrl: string;     // Original pasted URL
  latitude: number;      // From geocoder
  longitude: number;     // From geocoder
  collectionId: string;  // Defaults to "unorganized"
  createdAt: string;     // ISO 8601 timestamp
  placeId?: string;      // Google Places unique identifier
  primaryType?: string;  // Place type (e.g., "restaurant")
  rating?: number;       // Google rating (1.0–5.0)
  user_id?: string;      // Set when persisted to cloud
}

export interface Collection {
  id: string;            // UUID v4 or "unorganized" for default
  name: string;          // User-defined or "Unorganized"
  createdAt: string;     // ISO 8601 timestamp
  user_id?: string;      // Set when persisted to cloud
  isPublic?: boolean;    // Maps to is_public column in DB
}

export interface ScrapeResult {
  success: true;
  title: string;
  imageUrl: string | null; // null → use placeholder
  location: string;
  contextualHints: string[]; // e.g., ["Bali", "Indonesia"] from bio/caption
  sourceUrl: string;
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
  | { status: 'success'; lat: number; lng: number; displayName: string; enrichedData: EnrichedData }
  | { status: 'needs_user_input'; partialData: { title: string; imageUrl: string | null } }
  | { status: 'error'; error: string };
