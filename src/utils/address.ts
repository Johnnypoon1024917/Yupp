/**
 * Extracts the country name from a Google Places formatted address.
 * Returns the trimmed last comma-separated segment, or "Unknown Country"
 * for empty/undefined input.
 */
export function extractCountry(address: string | undefined): string {
  if (!address || !address.trim()) return 'Unknown Country';
  const segments = address.split(',').map((s) => s.trim());
  return segments[segments.length - 1] || 'Unknown Country';
}

/**
 * Extracts the city from a Google Places formatted address.
 * Heuristic: split by comma, take the second-to-last segment (the city
 * typically sits just before the country). If only one segment exists,
 * return that segment. Returns empty string for empty/undefined input.
 */
export function extractCity(address: string | undefined): string {
  if (!address || !address.trim()) return '';
  const segments = address.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return '';
  if (segments.length === 1) return segments[0];
  return segments[segments.length - 2];
}

/**
 * Returns the dominant city among a list of planned pins by grouping
 * pins by their extracted city and picking the one with the most pins.
 * Returns empty string when no pins have a valid city.
 */
export function getDominantCity(pins: { address?: string }[]): string {
  if (!pins || pins.length === 0) return '';

  const counts = new Map<string, number>();
  for (const pin of pins) {
    const city = extractCity(pin.address);
    if (!city) continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }

  if (counts.size === 0) return '';

  let dominant = '';
  let max = 0;
  for (const [city, count] of counts) {
    if (count > max) {
      max = count;
      dominant = city;
    }
  }
  return dominant;
}
