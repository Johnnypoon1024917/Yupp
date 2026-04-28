/**
 * Pure utility functions extracted from src/actions/extractPlaces.ts
 * so they can be imported by both server and client code without
 * triggering Next.js "Server actions must be async" errors.
 */

import type { ExtractedPlace, Platform } from '@/types';

/**
 * Detect the social media platform from a URL's hostname.
 */
export function detectPlatform(url: string): Platform {
  try {
    const { hostname } = new URL(url);

    if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) {
      return 'instagram';
    }
    if (hostname === 'v.douyin.com') {
      return 'douyin';
    }
    if (
      hostname === 'xiaohongshu.com' ||
      hostname.endsWith('.xiaohongshu.com') ||
      hostname === 'xhslink.com' ||
      hostname.endsWith('.xhslink.com')
    ) {
      return 'xiaohongshu';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

const EXTRACTION_PROMPT_TEMPLATE = `Extract all restaurants, attractions, or points of interest from this social media caption.

IMPORTANT INSTRUCTIONS:
- IGNORE narrative, emotional, or descriptive text (e.g. personal stories, feelings, recommendations). These are NOT place names.
- PRIORITIZE extraction from these patterns:
  1. @mentions (e.g. @restaurant_name) — these are often business/place accounts
  2. Physical addresses — especially CJK addresses containing markers like 市 (city), 區 (district), 路 (road), 街 (street), 號 (number), 巷 (lane), 弄 (alley)
  3. Business names — look for proper nouns that name a restaurant, café, hotel, or attraction
- Look for structured info blocks: lines prefixed with emojis like 📍, 🏵️, 🏠, 🍽️, 🏪 often contain place names or addresses
- For multilingual/CJK captions: the first line is often narrative text, NOT a place name. Scan the ENTIRE caption for structured place information.
- If an @mention is found, use the username (without @) as the place name.
- If a CJK address is found, include it in contextualHints.

Return ONLY a valid JSON array of objects: [{ "name": "Place Name", "contextualHints": ["City", "Neighborhood"] }]. Return an empty array if none found.`;

/**
 * Build the full extraction prompt by combining the template with the caption.
 */
export function buildExtractionPrompt(caption: string, ogTitle?: string): string {
  const authorLine = ogTitle ? `\nPost author / account name: ${ogTitle}` : '';
  return `${EXTRACTION_PROMPT_TEMPLATE}${authorLine}\n\nCaption: ${caption}`;
}

/**
 * Parse a raw LLM response string into an array of ExtractedPlace objects.
 */
export function parseLLMResponse(raw: string): ExtractedPlace[] {
  try {
    let cleaned = raw.trim();
    const fenceRegex = /^```(?:\w*)\s*\n?([\s\S]*?)\n?\s*```$/;
    const match = cleaned.match(fenceRegex);
    if (match) {
      cleaned = match[1].trim();
    }

    const parsed: unknown = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (el): el is ExtractedPlace =>
        el != null &&
        typeof el === 'object' &&
        'name' in el &&
        typeof (el as Record<string, unknown>).name === 'string'
    ).map((el) => ({
      name: el.name,
      contextualHints: Array.isArray(el.contextualHints)
        ? el.contextualHints.filter((h: unknown) => typeof h === 'string')
        : [],
    }));
  } catch {
    return [];
  }
}

/**
 * Attempt to extract a place name from a caption using simple heuristics.
 */
export function extractPlaceNameFromCaption(caption: string): string | null {
  if (!caption || caption.trim().length === 0) return null;

  const firstLine = caption.split('\n').filter((l) => l.trim().length > 0)[0]?.trim();
  if (!firstLine) return null;

  const withoutFlags = firstLine.replace(/^[\u{1F1E0}-\u{1F1FF}]{2,}\s*/u, '').trim();

  const separatorMatch = withoutFlags.match(/^(.+?)\s*[｜|·\-–—:]\s*/);
  if (separatorMatch?.[1]) {
    const candidate = separatorMatch[1].trim();
    if (candidate.length >= 2 && candidate.length <= 100) {
      return candidate;
    }
  }

  const pinMatch = caption.match(/📍\s*(.+?)(?:\n|$)/);
  if (pinMatch?.[1]) {
    const candidate = pinMatch[1].trim();
    if (candidate.length >= 2 && candidate.length <= 100) {
      return candidate;
    }
  }

  if (withoutFlags.length >= 2 && withoutFlags.length <= 60) {
    return withoutFlags;
  }

  const lines = caption.split('\n');
  for (const line of lines) {
    const mentionMatch = line.match(/@([A-Za-z0-9._]+)/);
    if (mentionMatch?.[1]) {
      const username = mentionMatch[1];
      if (username.length >= 2 && username.length <= 100) {
        return username;
      }
    }
  }

  const cjkAddressMarkers = /[市區路街號巷弄]/g;
  for (const line of lines) {
    const trimmedLine = line.trim();
    const markers = trimmedLine.match(cjkAddressMarkers);
    if (markers && markers.length >= 2) {
      const addressMatch = trimmedLine.match(
        /[\u4e00-\u9fff\u3400-\u4dbf0-9A-Za-z\-]+[市區路街號巷弄][\u4e00-\u9fff\u3400-\u4dbf0-9A-Za-z\-市區路街號巷弄]*/
      );
      if (addressMatch?.[0]) {
        const candidate = addressMatch[0].trim();
        if (candidate.length >= 2 && candidate.length <= 100) {
          const candidateMarkers = candidate.match(cjkAddressMarkers);
          if (candidateMarkers && candidateMarkers.length >= 2) {
            return candidate;
          }
        }
      }
    }
  }

  const placeEmojiPattern = /^(?:🏵️|🏵|🏠|🍽️|🍽|🏪|🏨|🏩|🏫|🏬|🏭|🏯|🏰|🍴|🍜|☕|🥘|🫕|🍕|🍔|🎪|🎭|⛪|🕌|🕍|⛩️|⛩|🗼|🗽|🎡|🎢|🏟️|🏟|🛍️|🛍|🎯|🏖️|🏖|🏝️|🏝|⛰️|⛰|🌊|🌸|🌺|🌴)\s*(.+)/u;
  for (const line of lines) {
    const trimmedLine = line.trim();
    const emojiMatch = trimmedLine.match(placeEmojiPattern);
    if (emojiMatch?.[1]) {
      const candidate = emojiMatch[1].trim();
      if (candidate.length >= 2 && candidate.length <= 100) {
        return candidate;
      }
    }
  }

  return null;
}
