import { detectPlatform } from '@/actions/extractPlaces';

/**
 * Regex to find HTTP(S) URLs in arbitrary text.
 * Matches URLs starting with http:// or https:// followed by
 * non-whitespace characters.
 */
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;

/**
 * Extract the first supported platform URL from arbitrary text.
 *
 * Scans the input string for HTTP(S) URLs, validates each candidate
 * against `detectPlatform`, and returns the first URL whose platform
 * is not `'unknown'`. Returns `null` if no supported URL is found.
 *
 * @param text - Arbitrary string that may contain URLs
 * @returns The first supported URL found, or `null`
 */
export function extractSupportedUrl(text: string): string | null {
  if (!text) return null;

  const matches = text.match(URL_REGEX);
  if (!matches) return null;

  for (const candidate of matches) {
    const platform = detectPlatform(candidate);
    if (platform !== 'unknown') {
      return candidate;
    }
  }

  return null;
}

/**
 * Capitalize the first letter of a platform name.
 *
 * @param platform - A platform identifier string (e.g. 'instagram')
 * @returns The platform name with the first letter capitalized (e.g. 'Instagram')
 */
export function formatPlatformName(platform: string): string {
  if (!platform) return platform;
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}
