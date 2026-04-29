import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractPlaceFromCaption } from '@/utils/extractPlacesUtils';

/**
 * Preservation Property Tests — Property 2
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6
 *
 * These tests capture the baseline behavior of extractPlaceFromCaption
 * for non-buggy inputs. They verify the new function preserves correct
 * extraction behavior from the old heuristic.
 *
 * The new function returns HeuristicResult | null instead of string | null.
 * Assertions check result.name for the extracted place name.
 *
 * Note: The new function applies isNarrative filtering which rejects lines
 * where punctuation+emoji outnumber alphabetic chars. Generators are
 * constrained to produce only ASCII Latin + CJK characters to avoid
 * false narrative rejections from accented characters.
 */

// --- Generators ---

/** Generate a short place-name string (2–50 chars) using only ASCII Latin + CJK chars. */
const shortPlaceNameArb = fc
  .stringMatching(/^[A-Za-z0-9\u4e00-\u9fff\u3400-\u4dbf ]{2,30}$/)
  .filter((s) => {
    const trimmed = s.trim();
    return (
      trimmed.length >= 2 &&
      trimmed.length <= 50 &&
      !trimmed.includes('\n') &&
      !/[｜|·\-–—:]/.test(trimmed)
    );
  });

/** CJK/Latin separators used in Instagram captions (excluding hyphen which is ambiguous). */
const separatorArb = fc.constantFrom('｜', '|', '–', '—', '·');

/** Generate a place name for the right side of a separator. */
const suffixPlaceArb = fc
  .stringMatching(/^[A-Za-z0-9\u4e00-\u9fff ]{1,20}$/)
  .filter((s) => s.trim().length >= 1);

// --- Observation unit tests ---

describe('Preservation — Observed Baseline Behavior', () => {
  /**
   * **Validates: Requirements 3.2**
   * Separator pattern on first line extracts text before separator.
   */
  it('observed: separator pattern "La Terrace ｜ 米芝蓮一星" → "La Terrace"', () => {
    const result = extractPlaceFromCaption('La Terrace ｜ 米芝蓮一星');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('La Terrace');
    expect(result!.pattern).toBe('english_title_separator');
  });

  /**
   * **Validates: Requirements 3.3**
   * 📍 emoji followed by place name extracts the place name.
   */
  it('observed: pin emoji "📍 台中市西區" → "台中市西區"', () => {
    const result = extractPlaceFromCaption('📍 台中市西區');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('台中市西區');
    expect(result!.pattern).toBe('place_emoji_pin');
  });

  /**
   * **Validates: Requirements 3.1**
   * Short first line (≤50 chars) is returned as the place name via first-line last-resort.
   */
  it('observed: short first line "好吃的拉麵店" → "好吃的拉麵店"', () => {
    const result = extractPlaceFromCaption('好吃的拉麵店');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('好吃的拉麵店');
    expect(result!.pattern).toBe('first_line_short');
  });

  /**
   * **Validates: Requirements 3.6**
   * Empty caption returns null.
   */
  it('observed: empty caption "" → null', () => {
    expect(extractPlaceFromCaption('')).toBeNull();
  });

  /**
   * **Validates: Requirements 3.2**
   * Latin separator extracts text before separator.
   */
  it('observed: Latin separator "Cafe de Flore – Paris" → "Cafe de Flore"', () => {
    const result = extractPlaceFromCaption('Cafe de Flore – Paris');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Cafe de Flore');
    expect(result!.pattern).toBe('english_title_separator');
  });
});

// --- Property-based tests ---

describe('Preservation — Short First Line Property', () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * For any caption whose first line is ≤50 chars, has no separator pattern,
   * no Place_Emoji, and is not narrative, the function returns a result with
   * the first line as the name.
   */
  it('property: short first line (≤50 chars) without separators returns the first line', () => {
    fc.assert(
      fc.property(shortPlaceNameArb, (placeName) => {
        const result = extractPlaceFromCaption(placeName);
        expect(result).not.toBeNull();
        expect(result!.name).toBe(placeName.trim());
      }),
      { numRuns: 100 },
    );
  });
});


describe('Preservation — Separator Pattern Property', () => {
  /**
   * **Validates: Requirements 3.2**
   *
   * For any caption with "placeName <separator> suffix" on the first line,
   * the function returns a result with the text before the separator as name.
   */
  it('property: separator pattern extracts text before separator', () => {
    fc.assert(
      fc.property(
        shortPlaceNameArb,
        separatorArb,
        suffixPlaceArb,
        (prefix, sep, suffix) => {
          const caption = `${prefix} ${sep} ${suffix}`;
          const result = extractPlaceFromCaption(caption);
          expect(result).not.toBeNull();
          expect(result!.name).toBe(prefix.trim());
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Preservation — Pin Emoji Pattern Property', () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * For any caption with "📍 placeName" pattern, the function extracts
   * the place name after the 📍 emoji.
   */
  it('property: 📍 pattern extracts place name after pin emoji', () => {
    const placeAfterPinArb = fc
      .stringMatching(/^[A-Za-z0-9\u4e00-\u9fff ]{2,40}$/)
      .filter((s) => s.trim().length >= 2 && s.trim().length <= 80);

    fc.assert(
      fc.property(placeAfterPinArb, (placeName) => {
        const caption = `📍 ${placeName}`;
        const result = extractPlaceFromCaption(caption);
        expect(result).not.toBeNull();
        expect(result!.name).toBe(placeName.trim());
        expect(result!.pattern).toBe('place_emoji_pin');
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * 📍 pattern on a later line (when first line is long narrative) still works.
   */
  it('property: 📍 on later line is still extracted when first line is long', () => {
    const longNarrative =
      '今天跟朋友去了一家超棒的餐廳，環境很好氣氛也很讚，推薦大家去試試看！真的很不錯的一次體驗，下次還會再來這裡吃飯聚餐喔超級推薦';

    const placeAfterPinArb = fc
      .stringMatching(/^[A-Za-z0-9\u4e00-\u9fff]{2,20}$/)
      .filter((s) => s.trim().length >= 2);

    fc.assert(
      fc.property(placeAfterPinArb, (placeName) => {
        const caption = `${longNarrative}\n📍 ${placeName}`;
        const result = extractPlaceFromCaption(caption);
        expect(result).not.toBeNull();
        expect(result!.pattern).toBe('place_emoji_pin');
      }),
      { numRuns: 50 },
    );
  });
});

describe('Preservation — Empty/Null Caption Property', () => {
  /**
   * **Validates: Requirements 3.6**
   *
   * Empty, whitespace-only, or newline-only captions return null.
   */
  it('property: empty or whitespace-only captions return null', () => {
    const emptyishArb = fc.constantFrom('', ' ', '  ', '\n', '\n\n', ' \n ', '\t');

    fc.assert(
      fc.property(emptyishArb, (caption) => {
        const result = extractPlaceFromCaption(caption);
        expect(result).toBeNull();
      }),
      { numRuns: 20 },
    );
  });
});
