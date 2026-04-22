import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractPlaceNameFromCaption } from '../extractPlaces';

/**
 * Preservation Property Tests — Property 2
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6
 *
 * These tests capture the baseline behavior of extractPlaceNameFromCaption
 * for non-buggy inputs (cases where isBugCondition returns false).
 * They must PASS on both unfixed and fixed code, confirming no regressions.
 *
 * Observation-first methodology: all expected values were observed on unfixed code:
 *   extractPlaceNameFromCaption("La Terrace ｜ 米芝蓮一星") → "La Terrace"
 *   extractPlaceNameFromCaption("📍 台中市西區") → "台中市西區"
 *   extractPlaceNameFromCaption("好吃的拉麵店") → "好吃的拉麵店"
 *   extractPlaceNameFromCaption("") → null
 *   extractPlaceNameFromCaption("Café de Flore - Paris") → "Café de Flore"
 */

// --- Generators ---

/** Generate a short place-name string (2–60 chars) without separators or newlines. */
const shortPlaceNameArb = fc
  .stringMatching(/^[\w\u4e00-\u9fff\u3400-\u4dbf\u00c0-\u024f ]{2,30}$/)
  .filter((s) => {
    const trimmed = s.trim();
    return (
      trimmed.length >= 2 &&
      trimmed.length <= 60 &&
      !trimmed.includes('\n') &&
      !/[｜|·\-–—:]/.test(trimmed)
    );
  });

/** CJK/Latin separators used in Instagram captions. */
const separatorArb = fc.constantFrom('｜', '|', '-', '–', '—', '·', ':');

/** Place-indicator emojis for 📍 pattern. */
const pinEmojiArb = fc.constant('📍');

/** Generate a place name for the right side of a separator (can be CJK or Latin). */
const suffixPlaceArb = fc
  .stringMatching(/^[\w\u4e00-\u9fff\u00c0-\u024f ]{1,20}$/)
  .filter((s) => s.trim().length >= 1);

// --- Observation unit tests ---

describe('Preservation — Observed Baseline Behavior', () => {
  /**
   * **Validates: Requirements 3.2**
   * Separator pattern on first line extracts text before separator.
   */
  it('observed: separator pattern "La Terrace ｜ 米芝蓮一星" → "La Terrace"', () => {
    expect(extractPlaceNameFromCaption('La Terrace ｜ 米芝蓮一星')).toBe('La Terrace');
  });

  /**
   * **Validates: Requirements 3.3**
   * 📍 emoji followed by place name extracts the place name.
   */
  it('observed: pin emoji "📍 台中市西區" → "台中市西區"', () => {
    expect(extractPlaceNameFromCaption('📍 台中市西區')).toBe('台中市西區');
  });

  /**
   * **Validates: Requirements 3.1**
   * Short first line (≤60 chars) is returned as the place name.
   */
  it('observed: short first line "好吃的拉麵店" → "好吃的拉麵店"', () => {
    expect(extractPlaceNameFromCaption('好吃的拉麵店')).toBe('好吃的拉麵店');
  });

  /**
   * **Validates: Requirements 3.6**
   * Empty caption returns null.
   */
  it('observed: empty caption "" → null', () => {
    expect(extractPlaceNameFromCaption('')).toBeNull();
  });

  /**
   * **Validates: Requirements 3.2**
   * Latin separator extracts text before separator.
   */
  it('observed: Latin separator "Café de Flore - Paris" → "Café de Flore"', () => {
    expect(extractPlaceNameFromCaption('Café de Flore - Paris')).toBe('Café de Flore');
  });
});

// --- Property-based tests ---

describe('Preservation — Short First Line Property', () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * For any caption whose first line is ≤60 chars, has no separator pattern,
   * and no 📍 emoji, the function returns the first line as the place name.
   */
  it('property: short first line (≤60 chars) without separators returns the first line', () => {
    fc.assert(
      fc.property(shortPlaceNameArb, (placeName) => {
        const result = extractPlaceNameFromCaption(placeName);
        expect(result).toBe(placeName.trim());
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.1, 3.5**
   *
   * Short first line followed by additional lines still returns the first line
   * (when no separator or 📍 pattern is present on the first line).
   */
  it('property: short first line with trailing lines still returns first line', () => {
    fc.assert(
      fc.property(
        shortPlaceNameArb,
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 3 }),
        (placeName, extraLines) => {
          const caption = [placeName, ...extraLines].join('\n');
          const result = extractPlaceNameFromCaption(caption);
          // The function checks first line first — short first line should still match
          // (unless a separator is present, which our generator excludes)
          expect(result).toBe(placeName.trim());
        },
      ),
      { numRuns: 50 },
    );
  });
});


describe('Preservation — Separator Pattern Property', () => {
  /**
   * **Validates: Requirements 3.2**
   *
   * For any caption with "placeName <separator> suffix" on the first line,
   * the function returns the text before the separator.
   */
  it('property: separator pattern extracts text before separator', () => {
    fc.assert(
      fc.property(
        shortPlaceNameArb,
        separatorArb,
        suffixPlaceArb,
        (prefix, sep, suffix) => {
          const caption = `${prefix} ${sep} ${suffix}`;
          const result = extractPlaceNameFromCaption(caption);
          // The separator regex captures text before the separator
          expect(result).not.toBeNull();
          expect(typeof result).toBe('string');
          // Result should be the prefix (text before separator), trimmed
          expect(result).toBe(prefix.trim());
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.2, 3.5**
   *
   * Separator pattern with additional lines still extracts from first line.
   */
  it('property: separator pattern with trailing lines still extracts from first line', () => {
    fc.assert(
      fc.property(
        shortPlaceNameArb,
        separatorArb,
        suffixPlaceArb,
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 3 }),
        (prefix, sep, suffix, extraLines) => {
          const caption = [`${prefix} ${sep} ${suffix}`, ...extraLines].join('\n');
          const result = extractPlaceNameFromCaption(caption);
          expect(result).toBe(prefix.trim());
        },
      ),
      { numRuns: 50 },
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
      .stringMatching(/^[\w\u4e00-\u9fff\u00c0-\u024f ]{2,40}$/)
      .filter((s) => s.trim().length >= 2 && s.trim().length <= 100);

    fc.assert(
      fc.property(placeAfterPinArb, (placeName) => {
        const caption = `📍 ${placeName}`;
        const result = extractPlaceNameFromCaption(caption);
        expect(result).toBe(placeName.trim());
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * 📍 pattern on a later line (when first line is long narrative) still works.
   * Note: this tests the existing 📍 scan which searches the full caption.
   */
  it('property: 📍 on later line is still extracted when first line is long', () => {
    const longNarrative =
      '今天跟朋友去了一家超棒的餐廳，環境很好氣氛也很讚，推薦大家去試試看！真的很不錯的一次體驗，下次還會再來這裡吃飯聚餐喔超級推薦';

    const placeAfterPinArb = fc
      .stringMatching(/^[\w\u4e00-\u9fff\u00c0-\u024f]{2,20}$/)
      .filter((s) => s.trim().length >= 2);

    fc.assert(
      fc.property(placeAfterPinArb, (placeName) => {
        const caption = `${longNarrative}\n📍 ${placeName}`;
        const result = extractPlaceNameFromCaption(caption);
        // The existing 📍 pattern scans the full caption, so this should work
        expect(result).toBe(placeName.trim());
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
        const result = extractPlaceNameFromCaption(caption);
        expect(result).toBeNull();
      }),
      { numRuns: 20 },
    );
  });
});
