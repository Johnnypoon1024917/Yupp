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
