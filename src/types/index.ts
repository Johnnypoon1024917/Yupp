export interface Pin {
  id: string;            // UUID v4
  title: string;         // From og:title or <title>
  imageUrl: string;      // From og:image or placeholder identifier
  sourceUrl: string;     // Original pasted URL
  latitude: number;      // From geocoder
  longitude: number;     // From geocoder
  collectionId: string;  // Defaults to "unorganized"
  createdAt: string;     // ISO 8601 timestamp
}

export interface Collection {
  id: string;            // UUID v4 or "unorganized" for default
  name: string;          // User-defined or "Unorganized"
  createdAt: string;     // ISO 8601 timestamp
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

export interface GeocodeResult {
  success: true;
  lat: number;
  lng: number;
  displayName: string;
  importance: number;
}

export interface GeocodeError {
  success: false;
  error: string;
}
