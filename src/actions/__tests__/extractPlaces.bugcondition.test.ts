import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractPlaceNameFromCaption } from '../extractPlaces';

/**
 * Bug Condition Exploration Test — Property 1
 * Validates: Requirements 1.1, 1.3, 1.4, 1.5, 2.1, 2.3, 2.4, 2.5
 *
 * Bug Condition: extractPlaceNameFromCaption returns null for long multilingual
 * captions where the first line is narrative text (>60 chars) but the caption
 * body contains extractable structured patterns (@mentions, CJK addresses,
 * emoji-marked info blocks).
 *
 * EXPECTED TO FAIL on unfixed code — failure confirms the bug exists because
 * the current heuristic only scans the first line.
 */

// A narrative first line that is >60 chars (.length) and is NOT a place name.
// 65 CJK characters of narrative/emotional text with no separators or place patterns.
const NARRATIVE_FIRST_LINE =
  '今天跟朋友去了一家超棒的餐廳，環境很好氣氛也很讚，推薦大家去試試看！真的很不錯的一次體驗，下次還會再來這裡吃飯聚餐喔超級推薦';

describe('Bug Condition — Structured Place Extraction from Long Multilingual Captions', () => {
  /**
   * **Validates: Requirements 1.3, 2.3**
   *
   * Caption with narrative first line (>60 chars) + @panslut.tw on a later line
   * (no 📍 pattern present) → expect non-null result containing the username
   */
  it('extracts @mention from caption with long narrative first line', () => {
    // Verify precondition: first line is >60 chars
    expect(NARRATIVE_FIRST_LINE.length).toBeGreaterThan(60);

    const caption = `${NARRATIVE_FIRST_LINE}\n好吃推薦\n@panslut.tw`;
    const result = extractPlaceNameFromCaption(caption);

    expect(result).not.toBeNull();
    expect(result).toContain('panslut.tw');
  });

  /**
   * **Validates: Requirements 1.4, 2.4**
   *
   * Caption with narrative first line + CJK address on a later line
   * (no 📍 or separator patterns) → expect non-null result containing the address
   */
  it('extracts CJK address from caption with long narrative first line', () => {
    const caption = `${NARRATIVE_FIRST_LINE}\n臺中市西區福人街60-1號`;
    const result = extractPlaceNameFromCaption(caption);

    expect(result).not.toBeNull();
    expect(result).toContain('臺中市西區福人街60-1號');
  });

  /**
   * **Validates: Requirements 1.5, 2.5**
   *
   * Caption with narrative first line + emoji-marked info block (🏵️, not 📍)
   * on a later line → expect non-null result containing the place name
   */
  it('extracts emoji-marked place name from caption with long narrative first line', () => {
    const caption = `${NARRATIVE_FIRST_LINE}\n🏵️ 盤子餐廳\n🕐 11:00-21:00`;
    const result = extractPlaceNameFromCaption(caption);

    expect(result).not.toBeNull();
    expect(result).toContain('盤子餐廳');
  });

  /**
   * **Validates: Requirements 1.1, 2.1**
   *
   * Caption with all three patterns present (no 📍) → expect non-null result
   */
  it('extracts place info when all three structured patterns are present', () => {
    const caption = [
      NARRATIVE_FIRST_LINE,
      '🏵️ 盤子餐廳',
      '臺中市西區福人街60-1號',
      '@panslut.tw',
      '🕐 11:00-21:00',
    ].join('\n');
    const result = extractPlaceNameFromCaption(caption);

    expect(result).not.toBeNull();
  });

  /**
   * **Validates: Requirements 2.1, 2.3**
   *
   * Property-based: for any caption with a long narrative first line (>60 chars)
   * and an @mention on a subsequent line, extractPlaceNameFromCaption should
   * return a non-null result.
   */
  it('property: long narrative + @mention → non-null extraction', () => {
    const usernameArb = fc.stringMatching(/^[a-z][a-z0-9._]{1,19}$/);

    fc.assert(
      fc.property(
        usernameArb,
        (username) => {
          const caption = `${NARRATIVE_FIRST_LINE}\n@${username}`;
          const result = extractPlaceNameFromCaption(caption);
          expect(result).not.toBeNull();
          expect(typeof result).toBe('string');
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * **Validates: Requirements 2.1, 2.4**
   *
   * Property-based: for any caption with a long narrative first line (>60 chars)
   * and a CJK address on a subsequent line, extractPlaceNameFromCaption should
   * return a non-null result.
   */
  it('property: long narrative + CJK address → non-null extraction', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          '臺中市西區福人街60-1號',
          '台北市大安區忠孝東路四段100號',
          '高雄市前鎮區中華五路789號',
          '新北市板橋區文化路一段200巷3弄5號',
        ),
        (address) => {
          const caption = `${NARRATIVE_FIRST_LINE}\n${address}`;
          const result = extractPlaceNameFromCaption(caption);
          expect(result).not.toBeNull();
          expect(typeof result).toBe('string');
        },
      ),
      { numRuns: 20 },
    );
  });

  /**
   * **Validates: Requirements 2.1, 2.5**
   *
   * Property-based: for any caption with a long narrative first line (>60 chars)
   * and an emoji-marked info block (non-📍) on a subsequent line,
   * extractPlaceNameFromCaption should return a non-null result.
   */
  it('property: long narrative + emoji info block → non-null extraction', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('🏵️', '🏠', '🍽️', '🏪'),
        fc.constantFrom('盤子餐廳', '好吃拉麵', 'Café de Flore', '鼎泰豐信義店'),
        (emoji, placeName) => {
          const caption = `${NARRATIVE_FIRST_LINE}\n${emoji} ${placeName}`;
          const result = extractPlaceNameFromCaption(caption);
          expect(result).not.toBeNull();
          expect(typeof result).toBe('string');
        },
      ),
      { numRuns: 20 },
    );
  });
});
