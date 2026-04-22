import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractCountry } from '@/utils/address';

// ===================================================================
// Feature: qa-hotfix-country-filter, Property 3: extractCountry returns last comma segment
// **Validates: Requirements 5.2, 5.3**
// ===================================================================

describe('Feature: qa-hotfix-country-filter, Property 3: extractCountry returns last comma segment', () => {
  it('for any non-empty comma-separated string, extractCountry returns the trimmed last segment', () => {
    // Generate at least 2 non-empty segments joined by commas
    const commaSeparatedArb = fc
      .array(fc.string({ minLength: 1 }), { minLength: 2 })
      .map((segments) => segments.join(','));

    fc.assert(
      fc.property(commaSeparatedArb, (address) => {
        const result = extractCountry(address);
        const segments = address.split(',');
        const expectedLastSegment = segments[segments.length - 1].trim();
        // If the last segment is empty after trimming, we expect "Unknown Country"
        if (expectedLastSegment === '') {
          expect(result).toBe('Unknown Country');
        } else {
          expect(result).toBe(expectedLastSegment);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('for any non-empty string with no commas, extractCountry returns the trimmed full string', () => {
    const noCommaStringArb = fc
      .string({ minLength: 1 })
      .filter((s) => !s.includes(',') && s.trim().length > 0);

    fc.assert(
      fc.property(noCommaStringArb, (address) => {
        const result = extractCountry(address);
        expect(result).toBe(address.trim());
      }),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Feature: qa-hotfix-country-filter, Property 4: extractCountry round-trip consistency
// **Validates: Requirements 5.5**
// ===================================================================

describe('Feature: qa-hotfix-country-filter, Property 4: extractCountry round-trip consistency', () => {
  it('extracting country then appending it to any prefix produces the same country value', () => {
    // Generate a non-empty address string (at least one non-whitespace char)
    const addressArb = fc
      .array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 })
      .map((segments) => segments.join(', '))
      .filter((s) => s.trim().length > 0);

    // Generate an arbitrary prefix string
    const prefixArb = fc.string({ minLength: 0, maxLength: 50 });

    fc.assert(
      fc.property(addressArb, prefixArb, (addr, anyPrefix) => {
        const country = extractCountry(addr);
        const roundTripped = extractCountry(anyPrefix + ', ' + country);
        expect(roundTripped).toBe(country);
      }),
      { numRuns: 100 },
    );
  });
});
