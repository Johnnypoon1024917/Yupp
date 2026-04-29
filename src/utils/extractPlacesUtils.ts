/**
 * Pure utility functions extracted from src/actions/extractPlaces.ts
 * so they can be imported by both server and client code without
 * triggering Next.js "Server actions must be async" errors.
 */

import type { ExtractedPlace, HeuristicResult, Platform } from '@/types';

/**
 * Emojis that semantically point to a physical place.
 * Exported for reuse by pattern detectors.
 */
export const PLACE_EMOJI = new Set([
  '📍', '🏠', '🍽', '🍴', '🏨', '🏩', '🏪', '🏬', '🏭', '🏯', '🏰',
  '🏟', '⛪', '🕌', '🕍', '⛩', '🗼', '🗽', '🛍', '🎯', '🏖', '🏝',
  '⛰', '🌊',
]);

/**
 * CJK sentence particles that signal narrative/emotional text when they
 * appear at the end of a line.
 */
const CJK_SENTENCE_PARTICLES = new Set([
  '啦', '呀', '喔', '吧', '嘅', '咗', '囉', '嘛', '啊', '哦', '呢', '吖',
]);

/**
 * Iterate over the grapheme clusters of a string and yield each emoji
 * codepoint (single codepoint emoji or base of a ZWJ/VS16 sequence).
 * Uses the Unicode emoji property via regex.
 */
function* iterateEmoji(str: string): Generator<string> {
  // Match emoji presentation sequences, including those with variation selectors and ZWJ sequences
  const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;
  let m: RegExpExecArray | null;
  while ((m = emojiRegex.exec(str)) !== null) {
    yield m[0];
  }
}

/**
 * Count emoji codepoints in a string that are NOT in the Place_Emoji set.
 * Emoji with variation selectors (e.g. ⛩️ U+26E9 U+FE0F) are matched
 * against the set using the base character.
 */
function countNonPlaceEmoji(str: string): number {
  let count = 0;
  for (const emoji of iterateEmoji(str)) {
    // Strip variation selector to match against the set base chars
    const base = emoji.replace(/\uFE0F/g, '');
    if (!PLACE_EMOJI.has(base) && !PLACE_EMOJI.has(emoji)) {
      count++;
    }
  }
  return count;
}

/**
 * Returns `true` when a line exhibits narrative signals — meaning it is
 * emotional or descriptive text rather than a place name.
 *
 * Signals (any one is sufficient):
 * 1. ≥ 3 non-Place emoji codepoints
 * 2. ≥ 2 consecutive `!` or `?` (including ‼️ U+203C, ⁉️ U+2049)
 * 3. Ends with a CJK sentence particle
 * 4. Punctuation+emoji chars outnumber CJK/Latin alphabetic chars
 *
 * Pure function, no side effects.
 */
export function isNarrative(line: string): boolean {
  if (!line || line.trim().length === 0) return false;

  const trimmed = line.trim();

  // Signal 1: ≥ 3 non-Place emoji
  if (countNonPlaceEmoji(trimmed) >= 3) return true;

  // Signal 2: ≥ 2 consecutive ! or ? (including Unicode ‼️ U+203C and ⁉️ U+2049)
  // Normalize ‼ (U+203C) → !! and ⁉ (U+2049) → ?! before checking
  const normalizedBangs = trimmed
    .replace(/\u203C\uFE0F?/g, '!!')
    .replace(/\u2049\uFE0F?/g, '?!');
  if (/[!?]{2,}/.test(normalizedBangs)) return true;

  // Signal 3: ends with CJK sentence particle
  const lastChar = trimmed[trimmed.length - 1];
  if (CJK_SENTENCE_PARTICLES.has(lastChar)) return true;

  // Signal 4: punctuation+emoji chars outnumber CJK/Latin alphabetic chars
  // CJK Unified Ideographs: U+4E00–U+9FFF, U+3400–U+4DBF
  // Latin: A-Z a-z
  const alphabeticCount = (
    trimmed.match(/[\u4e00-\u9fff\u3400-\u4dbfA-Za-z]/g) || []
  ).length;

  // Count punctuation + emoji characters
  // Punctuation: anything that's not alphanumeric, not CJK, not whitespace
  let punctEmojiCount = 0;
  for (const emoji of iterateEmoji(trimmed)) {
    punctEmojiCount++;
    // We'll subtract these from the string for punctuation counting below
  }
  // Also count non-emoji punctuation (anything not letter, digit, CJK, whitespace)
  const withoutEmoji = trimmed.replace(/\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu, '');
  const nonAlphaCount = (
    withoutEmoji.match(/[^\w\s\u4e00-\u9fff\u3400-\u4dbf]/g) || []
  ).length;
  punctEmojiCount += nonAlphaCount;

  if (alphabeticCount > 0 && punctEmojiCount > alphabeticCount) return true;
  if (alphabeticCount === 0 && punctEmojiCount > 0) return true;

  return false;
}

/**
 * Regex matching a CJK address-block label line.
 * Matches 地址 followed by a full-width or ASCII colon (with optional
 * surrounding whitespace) and then the address content.
 */
const CJK_ADDRESS_LINE_RE = /^.*地址\s*[：:]\s*(.+)/;

/**
 * Regex matching CJK structured-block label lines (phone, hours) that
 * should NOT be treated as name candidates. Covers both Traditional and
 * Simplified Chinese variants.
 */
const CJK_BLOCK_LABEL_RE = /^(?:電話|电话|營業時間|营业时间|地址)\s*[：:]/;

/**
 * Extract a parenthesized district hint from a name line.
 * Matches both full-width and ASCII parentheses.
 * e.g. "鮨匠 割烹 （尖沙咀）" → "尖沙咀"
 */
function extractDistrictHint(nameLine: string): string | null {
  const m = nameLine.match(/[（(](.+?)[）)]/);
  return m ? m[1].trim() : null;
}

/**
 * Strip parenthesized suffix from a name line to get the clean name.
 * e.g. "鮨匠 割烹 （尖沙咀）" → "鮨匠 割烹"
 */
function stripParenSuffix(nameLine: string): string {
  return nameLine.replace(/\s*[（(].+?[）)]/, '').trim();
}

/**
 * Detect a CJK Address Block pattern in caption lines.
 *
 * Scans for lines matching `地址[：:]\s*.+`, then looks back up to 3 lines
 * for a valid name candidate. Handles Traditional and Simplified Chinese
 * markers, both full-width and ASCII colons, parenthesized district hints,
 * narrative filtering, and ogTitle skipping.
 *
 * Returns a HeuristicResult with confidence 0.9 and pattern 'cjk_address_block',
 * or null if no match is found.
 */
export function detectCjkAddressBlock(
  lines: string[],
  ogTitle?: string,
): HeuristicResult | null {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const addressMatch = trimmed.match(CJK_ADDRESS_LINE_RE);
    if (!addressMatch) continue;

    const address = addressMatch[1].trim();

    // Look back up to 3 lines for a name candidate
    for (let back = 1; back <= Math.min(3, i); back++) {
      const candidateLine = lines[i - back].trim();

      // Skip empty lines
      if (candidateLine.length === 0) continue;

      // Skip lines that are themselves block labels (phone, hours, address)
      if (CJK_BLOCK_LABEL_RE.test(candidateLine)) continue;

      // Skip narrative lines — but allow one extra look-back
      if (isNarrative(candidateLine)) continue;

      // Skip lines matching ogTitle (case-insensitive)
      if (
        ogTitle &&
        candidateLine.toLowerCase() === ogTitle.trim().toLowerCase()
      ) {
        continue;
      }

      // Valid name candidate found
      const districtHint = extractDistrictHint(candidateLine);
      const name = stripParenSuffix(candidateLine);

      if (name.length === 0) continue;

      return {
        name,
        address,
        districtHint,
        confidence: 0.9,
        pattern: 'cjk_address_block',
      };
    }
  }

  return null;
}

/**
 * CJK address markers used for confidence elevation in the Place Emoji
 * detector and for standalone address detection.
 */
const CJK_ADDRESS_MARKERS_RE = /[市區区路街號号巷弄道村鎮镇]/;

/**
 * Strip trailing punctuation, hashtags, and non-Place emoji from a
 * candidate place name extracted after a Place_Emoji.
 */
function stripTrailingNoise(name: string): string {
  // Iteratively strip from the end: hashtags, non-place emoji, punctuation
  let result = name.trim();

  // Remove trailing hashtags (e.g. "#food #taipei")
  result = result.replace(/(?:\s*#\S+)+\s*$/, '').trim();

  // Remove trailing non-Place emoji (walk backwards through the string)
  // We repeatedly strip a trailing emoji if it's not a Place emoji
  const emojiTailRe = /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*$/u;
  let safety = 20; // prevent infinite loop
  while (safety-- > 0) {
    const m = result.match(emojiTailRe);
    if (!m) break;
    const emoji = m[0].trim();
    const base = emoji.replace(/\uFE0F/g, '');
    if (PLACE_EMOJI.has(base) || PLACE_EMOJI.has(emoji)) break; // keep place emoji
    result = result.slice(0, result.length - m[0].length).trim();
  }

  // Remove trailing punctuation (ASCII and CJK common punctuation)
  result = result.replace(/[\s.,;:!?。，；：！？、…·\-–—~～]+$/, '').trim();

  return result;
}

/**
 * Detect a Place Emoji pattern in caption lines.
 *
 * Matches lines starting with any emoji from the PLACE_EMOJI set followed
 * by 2–80 characters of text. Strips trailing punctuation, hashtags, and
 * non-Place emoji from the extracted name. Elevates confidence from 0.75
 * to 0.85 when the next line contains CJK address markers or `地址`, and
 * populates the `address` field in that case.
 *
 * Candidates rejected by `isNarrative` are skipped.
 *
 * Returns a HeuristicResult with pattern 'place_emoji_pin', or null.
 */
export function detectPlaceEmoji(
  lines: string[],
): HeuristicResult | null {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0) continue;

    // Check if line starts with a Place emoji
    // We need to check the first grapheme — try matching each known emoji at position 0
    let emojiLen = 0;
    for (const emoji of PLACE_EMOJI) {
      // Also check with variation selector appended
      if (trimmed.startsWith(emoji + '\uFE0F')) {
        emojiLen = emoji.length + 1; // +1 for VS16
        break;
      }
      if (trimmed.startsWith(emoji)) {
        emojiLen = emoji.length;
        break;
      }
    }
    if (emojiLen === 0) continue;

    // Extract text after the emoji (skip optional whitespace)
    const afterEmoji = trimmed.slice(emojiLen).replace(/^\s+/, '');
    if (afterEmoji.length < 2 || afterEmoji.length > 80) continue;

    // Strip trailing noise
    const cleanedName = stripTrailingNoise(afterEmoji);
    if (cleanedName.length < 2) continue;

    // Skip narrative candidates
    if (isNarrative(cleanedName)) continue;

    // Check next line for CJK address markers or 地址 → elevate confidence
    let confidence = 0.75;
    let address: string | null = null;

    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const hasAddressMarkers = CJK_ADDRESS_MARKERS_RE.test(nextLine);
      const hasAddressLabel = nextLine.includes('地址');
      if (hasAddressMarkers || hasAddressLabel) {
        confidence = 0.85;
        address = nextLine;
      }
    }

    return {
      name: cleanedName,
      address,
      districtHint: null,
      confidence,
      pattern: 'place_emoji_pin',
    };
  }

  return null;
}

/**
 * Regex matching a CJK address marker for counting individual occurrences.
 * Covers: 市, 區/区, 路, 街, 號/号, 巷, 弄, 道, 村, 鎮/镇
 */
const CJK_ADDRESS_MARKERS_GLOBAL_RE = /[市區区路街號号巷弄道村鎮镇]/g;

/**
 * Regex matching a common English street-type word preceded by a digit sequence.
 * Case-insensitive. Matches patterns like "123 Main Street" or "45 Elm Blvd".
 */
const ENGLISH_ADDRESS_RE = /\d+\s+[\w\s]*?\b(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Way|Terrace|Ter|Circle|Cir|Highway|Hwy|Parkway|Pkwy)\b/i;

/**
 * Detect a standalone address line in caption lines.
 *
 * Matches either:
 * - CJK lines containing ≥ 2 CJK_Address_Markers and ≥ 1 digit
 * - English lines matching a digit sequence followed by a street-type word
 *
 * Returns a HeuristicResult with confidence 0.55 and pattern 'standalone_address',
 * or null if no match is found.
 */
export function detectStandaloneAddress(
  lines: string[],
): HeuristicResult | null {
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    // CJK address: ≥ 2 address markers + ≥ 1 digit
    const cjkMarkers = trimmed.match(CJK_ADDRESS_MARKERS_GLOBAL_RE);
    if (cjkMarkers && cjkMarkers.length >= 2 && /\d/.test(trimmed)) {
      return {
        name: trimmed,
        address: trimmed,
        districtHint: null,
        confidence: 0.55,
        pattern: 'standalone_address',
      };
    }

    // English address: digit sequence + street-type word
    if (ENGLISH_ADDRESS_RE.test(trimmed)) {
      return {
        name: trimmed,
        address: trimmed,
        districtHint: null,
        confidence: 0.55,
        pattern: 'standalone_address',
      };
    }
  }

  return null;
}

/**
 * Detect an English Title-Separator pattern in caption lines.
 *
 * Matches the first non-empty line containing a separator character from
 * the set: ｜ (full-width pipe), | (ASCII pipe), · (middle dot),
 * — (em dash), – (en dash), - (hyphen).
 *
 * Extracts text before the first separator as the candidate name (must be
 * 2–80 chars). Rejects if `isNarrative` returns true for the extracted
 * segment.
 *
 * Returns a HeuristicResult with confidence 0.6 and pattern
 * 'english_title_separator', or null if no match is found.
 */
export function detectEnglishTitleSeparator(
  lines: string[],
): HeuristicResult | null {
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    // Find the first separator character from the set
    // Order matters: check multi-byte characters first, then single-byte
    const separatorRe = /[｜|·—–\-]/;
    const sepMatch = trimmed.match(separatorRe);
    if (!sepMatch || sepMatch.index === undefined) continue;

    const candidate = trimmed.slice(0, sepMatch.index).trim();

    // Reject if candidate is too short or too long
    if (candidate.length < 2 || candidate.length > 80) continue;

    // Reject narrative candidates
    if (isNarrative(candidate)) continue;

    return {
      name: candidate,
      address: null,
      districtHint: null,
      confidence: 0.6,
      pattern: 'english_title_separator',
    };
  }

  return null;
}

/**
 * Detect a First-Line Last-Resort pattern in caption lines.
 *
 * Evaluates the first non-empty line of the caption only — this pattern
 * is the lowest priority, called after all other patterns fail.
 *
 * Accepts only if the line is 2–50 characters (inclusive), `isNarrative`
 * returns false, and the line does not match `ogTitle` (case-insensitive,
 * after trimming).
 *
 * Returns a HeuristicResult with confidence 0.35 and pattern
 * 'first_line_short', or null if the candidate fails any filter.
 */
export function detectFirstLineLastResort(
  lines: string[],
  ogTitle?: string,
): HeuristicResult | null {
  // Find the first non-empty line
  const firstLine = lines.find((l) => l.trim().length > 0);
  if (!firstLine) return null;

  const candidate = firstLine.trim();

  // Length filter: 2–50 characters inclusive
  if (candidate.length < 2 || candidate.length > 50) return null;

  // Narrative filter
  if (isNarrative(candidate)) return null;

  // ogTitle filter: case-insensitive match after trimming
  if (
    ogTitle &&
    candidate.toLowerCase() === ogTitle.trim().toLowerCase()
  ) {
    return null;
  }

  return {
    name: candidate,
    address: null,
    districtHint: null,
    confidence: 0.35,
    pattern: 'first_line_short',
  };
}

/** Confidence threshold for auto-create (no review needed). */
export const CONFIDENCE_HIGH = 0.7;

/** Confidence threshold for create-with-review. Below this → loud failure. */
export const CONFIDENCE_MEDIUM = 0.4;

/**
 * Regex matching region prefixes on @mentions — 2–3 letter geographic
 * codes followed by an underscore (e.g., hk_, tw_, sg_, jp_).
 */
const REGION_PREFIX_RE = /^[a-z]{2,3}_/i;

/**
 * Regex matching a CJK district hashtag — a `#` followed by 2–5 CJK
 * characters (typical district/neighborhood names like 尖沙咀, 中環, 信義區).
 */
const DISTRICT_HASHTAG_RE = /#([\u4e00-\u9fff\u3400-\u4dbf]{2,5})/g;

/**
 * Detect an @mention pattern in the full caption text.
 *
 * Extracts the first valid `@[A-Za-z0-9._]+` mention, cleans the handle
 * by replacing underscores/dots with spaces and stripping region prefixes.
 * Skips mentions whose cleaned name matches `ogTitle` (case-insensitive).
 *
 * Confidence is elevated from 0.65 to 0.75 when the caption contains a
 * CJK district hashtag, and `districtHint` is populated from that hashtag.
 *
 * Returns a HeuristicResult with pattern 'mention_with_hashtags', or null.
 */
export function detectMention(
  caption: string,
  ogTitle?: string,
): HeuristicResult | null {
  const mentionRe = /@([A-Za-z0-9._]+)/g;
  let match: RegExpExecArray | null;

  // Find district hashtag from the full caption (CJK hashtags, 2–5 chars)
  const districtMatch = caption.match(DISTRICT_HASHTAG_RE);
  const districtHint = districtMatch
    ? districtMatch[0].slice(1) // strip the leading #
    : null;
  const hasDistrictHashtag = districtHint !== null;

  while ((match = mentionRe.exec(caption)) !== null) {
    let cleaned = match[1];

    // Strip region prefix BEFORE replacing separators (e.g., hk_restaurant → restaurant)
    cleaned = cleaned.replace(REGION_PREFIX_RE, '');

    // Replace underscores and dots with spaces
    cleaned = cleaned.replace(/[_.]/g, ' ').trim();

    // Skip empty results
    if (cleaned.length < 2) continue;

    // Skip mentions matching ogTitle (case-insensitive)
    if (
      ogTitle &&
      cleaned.toLowerCase() === ogTitle.trim().toLowerCase()
    ) {
      continue;
    }

    // Skip narrative candidates
    if (isNarrative(cleaned)) continue;

    return {
      name: cleaned,
      address: null,
      districtHint,
      confidence: hasDistrictHashtag ? 0.75 : 0.65,
      pattern: 'mention_with_hashtags',
    };
  }

  return null;
}

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
 * Main entry point for the heuristic caption extractor.
 *
 * Evaluates 6 detection patterns in strict priority order:
 *   1. CJK Address Block (0.9)
 *   2. Place Emoji (0.75 / 0.85)
 *   3. @mention + hashtags (0.65 / 0.75)
 *   4. Standalone Address (0.55)
 *   5. English Title-Separator (0.6)
 *   6. First-Line Last-Resort (0.35)
 *
 * Each detector already applies `isNarrative` internally. Returns the
 * first non-null result, or null if all detectors miss.
 *
 * Pure, synchronous, no side effects.
 */
export function extractPlaceFromCaption(
  caption: string,
  ogTitle?: string,
): HeuristicResult | null {
  if (!caption || caption.trim().length === 0) return null;

  const lines = caption.split('\n');

  // Priority 1: CJK Address Block
  const cjk = detectCjkAddressBlock(lines, ogTitle);
  if (cjk) return cjk;

  // Priority 2: Place Emoji
  const emoji = detectPlaceEmoji(lines);
  if (emoji) return emoji;

  // Priority 3: @mention + hashtags
  const mention = detectMention(caption, ogTitle);
  if (mention) return mention;

  // Priority 4: Standalone Address
  const address = detectStandaloneAddress(lines);
  if (address) return address;

  // Priority 5: English Title-Separator
  const separator = detectEnglishTitleSeparator(lines);
  if (separator) return separator;

  // Priority 6: First-Line Last-Resort
  const firstLine = detectFirstLineLastResort(lines, ogTitle);
  if (firstLine) return firstLine;

  return null;
}
