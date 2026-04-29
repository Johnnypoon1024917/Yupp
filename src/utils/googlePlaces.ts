/**
 * Builds a Google Places photo URL from a photo resource name.
 * NOTE: This should only be called server-side where GOOGLE_PLACES_API_KEY is available.
 * For client-side usage, photo URLs should be pre-resolved in geocodeLocation.ts.
 * @param photoName - The photo resource name from the Places API (e.g. "places/xxx/photos/yyy")
 * @param apiKey - The Google Places API key
 * @param maxWidth - Maximum width in pixels (default 400)
 */
export function buildPlacePhotoUrl(photoName: string, apiKey: string, maxWidth: number = 400): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;
}
