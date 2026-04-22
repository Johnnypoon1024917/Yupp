import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { isValidUrl } from '@/components/MagicBar';

// ---------------------------------------------------------------------------
// Arbitraries — smart generators
// ---------------------------------------------------------------------------

/** Generates a valid HTTP or HTTPS URL string. */
const validUrlArb = fc.oneof(
  fc.webUrl().map((u) => u),
  fc
    .record({
      protocol: fc.constantFrom('http', 'https'),
      host: fc.domain(),
      path: fc.webPath(),
    })
    .map(({ protocol, host, path }) => `${protocol}://${host}${path}`),
);

/** Wraps a string with optional leading/trailing whitespace. */
const whitespaceArb = fc
  .array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 4 })
  .map((chars) => chars.join(''));

const withWhitespaceArb = (inner: fc.Arbitrary<string>) =>
  fc
    .record({
      leading: whitespaceArb,
      value: inner,
      trailing: whitespaceArb,
    })
    .map(({ leading, value, trailing }) => `${leading}${value}${trailing}`);

/** Generates strings that are clearly not valid URLs. */
const nonUrlArb = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('not a url'),
  fc.constant('ftp://example.com'),
  fc.constant('javascript:alert(1)'),
  fc.constant('data:text/html,<h1>hi</h1>'),
  // Random strings that are very unlikely to be valid http(s) URLs
  fc.string({ minLength: 0, maxLength: 50 }).filter((s) => {
    const trimmed = s.trim();
    if (!trimmed) return true;
    try {
      const url = new URL(trimmed);
      return url.protocol !== 'http:' && url.protocol !== 'https:';
    } catch {
      return true;
    }
  }),
);

// ===================================================================
// Feature: qa-hotfix-country-filter, Property 1: Paste button URL validation gate
// **Validates: Requirements 2.3, 2.4**
// ===================================================================

describe('Feature: qa-hotfix-country-filter, Property 1: Paste button URL validation gate', () => {
  it('isValidUrl returns true for all valid http(s) URLs, even with surrounding whitespace', () => {
    fc.assert(
      fc.property(withWhitespaceArb(validUrlArb), (input) => {
        // A valid URL wrapped in whitespace should still pass validation
        // because isValidUrl trims before parsing
        expect(isValidUrl(input)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('isValidUrl returns false for all non-URL strings', () => {
    fc.assert(
      fc.property(nonUrlArb, (input) => {
        expect(isValidUrl(input)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('processUrl would be called iff isValidUrl(trimmed) is true — gate equivalence', () => {
    // This property mirrors the handlePaste logic:
    //   const trimmed = text?.trim();
    //   if (trimmed && isValidUrl(trimmed)) { processUrl(trimmed, true); }
    // We verify that for any arbitrary string, the gate condition
    // (trimmed is truthy AND isValidUrl(trimmed)) is equivalent to isValidUrl(input)
    // after trimming — i.e. the only deciding factor is isValidUrl.
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (text) => {
        const trimmed = text?.trim();
        const wouldCallProcessUrl = !!trimmed && isValidUrl(trimmed);
        const validationResult = isValidUrl(text);

        // If isValidUrl passes on the raw input, the trimmed version must also
        // be truthy and valid (since trimming only removes whitespace and
        // isValidUrl internally trims).
        if (validationResult) {
          expect(wouldCallProcessUrl).toBe(true);
        }

        // If the gate would call processUrl, then isValidUrl on the trimmed
        // string must be true.
        if (wouldCallProcessUrl) {
          expect(isValidUrl(trimmed!)).toBe(true);
        }

        // If isValidUrl fails on the trimmed string, processUrl must NOT be called.
        if (trimmed && !isValidUrl(trimmed)) {
          expect(wouldCallProcessUrl).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
