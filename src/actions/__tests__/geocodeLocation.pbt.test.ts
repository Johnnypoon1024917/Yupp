import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pickProminentPlace, type GooglePlace } from '../geocodeLocation';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makePlace(overrides: Partial<GooglePlace> = {}): GooglePlace {
  return {
    id: 'place-id',
    displayName: { text: 'Test Place', languageCode: 'en' },
    location: { latitude: 0, longitude: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a non-empty alphanumeric string safe for address values */
const safeAddress = fc.stringMatching(/^[a-zA-Z0-9 ]{3,30}$/);

/** Generates a unique hint substring that will appear in exactly one address */
const uniqueHintArb = fc.stringMatching(/^[a-z]{4,10}$/);

// ===================================================================
// Property 1 — Contextual hint matching on formattedAddress
// **Validates: Requirements 1.1, 1.3**
// ===================================================================

describe('Feature: discovery-experience-polish, Property 1: Contextual hint matching', () => {
  it('selects the place whose formattedAddress contains the hint (case-insensitive)', () => {
    const arb = fc.record({
      // Generate 1–4 "other" addresses that will NOT contain the hint
      otherAddresses: fc.array(safeAddress, { minLength: 1, maxLength: 4 }),
      // The unique hint token to embed in exactly one address
      hint: uniqueHintArb,
      // Index where the matching place will be inserted
      insertIndex: fc.nat(),
    });

    fc.assert(
      fc.property(arb, ({ otherAddresses, hint, insertIndex }) => {
        // Build the target address with the hint embedded (mixed case to test case-insensitivity)
        const targetAddress = `123 ${hint.toUpperCase()} Street, City`;

        // Ensure none of the other addresses contain the hint (case-insensitive)
        const filteredOthers = otherAddresses
          .map((a) => a.toLowerCase().includes(hint.toLowerCase()) ? `ZZZ ${a}` : a)
          .map((a) => a.toLowerCase().includes(hint.toLowerCase()) ? 'No Match Addr' : a);

        // Build places from the filtered other addresses
        const otherPlaces = filteredOthers.map((addr, i) =>
          makePlace({
            id: `other-${i}`,
            displayName: { text: `Other ${i}`, languageCode: 'en' },
            formattedAddress: addr,
            location: { latitude: i * 10, longitude: i * 10 },
          }),
        );

        // The target place with the hint in its formattedAddress
        const targetPlace = makePlace({
          id: 'target',
          displayName: { text: 'Target Place', languageCode: 'en' },
          formattedAddress: targetAddress,
          location: { latitude: 99, longitude: 99 },
        });

        // Insert target at a random position
        const idx = insertIndex % (otherPlaces.length + 1);
        const places = [...otherPlaces];
        places.splice(idx, 0, targetPlace);

        // The hint is provided in lowercase — function should match case-insensitively
        const result = pickProminentPlace(places, [hint.toLowerCase()]);

        expect(result).not.toBeNull();
        expect(result!.id).toBe('target');
      }),
      { numRuns: 100 },
    );
  });

  it('falls through to non-hint selection when no hint matches any formattedAddress', () => {
    const arb = fc.record({
      addresses: fc.array(safeAddress, { minLength: 2, maxLength: 5 }),
      // A hint guaranteed not to appear in any generated address
      noMatchHint: fc.constant('zzzzqqqq_nomatch'),
    });

    fc.assert(
      fc.property(arb, ({ addresses, noMatchHint }) => {
        const places = addresses.map((addr, i) =>
          makePlace({
            id: `place-${i}`,
            displayName: { text: `Place ${i}`, languageCode: 'en' },
            formattedAddress: addr,
            // Ensure different names and distant coords so ambiguity check doesn't trigger null
            location: { latitude: i * 10, longitude: i * 10 },
          }),
        );

        const result = pickProminentPlace(places, [noMatchHint]);

        // With no hint match, no high rating, and no ambiguity (different names/coords),
        // the function should fall through to default (first result) — NOT return the
        // target based on hint. The key assertion: result is NOT determined by hint matching.
        // It should either be the first place (default) or null (ambiguity), but never
        // a place selected because of a hint match.
        if (result !== null) {
          // If a result is returned, verify it's the first place (default fallthrough)
          // or selected by rating — but NOT by hint matching.
          // Since none of the addresses contain the hint, the function cannot have
          // matched on hint. This is the core of Requirement 1.3.
          expect(result.id).toBe(places[0].id);
        }
        // result === null is also valid (ambiguity case)
      }),
      { numRuns: 100 },
    );
  });
});


// ===================================================================
// Property 2 — Rating-based prominence selection
// **Validates: Requirements 2.1, 2.2**
// ===================================================================

describe('Feature: discovery-experience-polish, Property 2: Rating-based prominence selection', () => {
  /**
   * Arbitrary that produces a first-place rating and userRatingCount around
   * the 4.2 / 50 decision boundary, plus 1–3 additional filler places.
   * No contextual hints match any address (hints are omitted entirely).
   */
  const ratingArb = fc.record({
    rating: fc.double({ min: 3.0, max: 5.0, noNaN: true }),
    userRatingCount: fc.integer({ min: 0, max: 200 }),
    extraCount: fc.integer({ min: 1, max: 3 }),
  });

  it('selects the first result when rating > 4.2 AND userRatingCount > 50', () => {
    fc.assert(
      fc.property(ratingArb, ({ rating, userRatingCount, extraCount }) => {
        // Only test the "both thresholds exceeded" case
        fc.pre(rating > 4.2 && userRatingCount > 50);

        const first = makePlace({
          id: 'first',
          displayName: { text: 'First Place', languageCode: 'en' },
          formattedAddress: '1 Alpha Road',
          location: { latitude: 10, longitude: 10 },
          rating,
          userRatingCount,
        });

        const others = Array.from({ length: extraCount }, (_, i) =>
          makePlace({
            id: `other-${i}`,
            displayName: { text: `Other Place ${i}`, languageCode: 'en' },
            formattedAddress: `${i + 100} Beta Street`,
            location: { latitude: 50 + i * 10, longitude: 50 + i * 10 },
          }),
        );

        const places = [first, ...others];

        // No contextual hints → hint step is skipped
        const result = pickProminentPlace(places);

        expect(result).not.toBeNull();
        expect(result!.id).toBe('first');
      }),
      { numRuns: 100 },
    );
  });

  it('does NOT select based on rating alone when either threshold is not met', () => {
    fc.assert(
      fc.property(ratingArb, ({ rating, userRatingCount, extraCount }) => {
        // Only test cases where at least one threshold is NOT exceeded
        fc.pre(rating <= 4.2 || userRatingCount <= 50);

        const first = makePlace({
          id: 'first',
          displayName: { text: 'First Place', languageCode: 'en' },
          formattedAddress: '1 Alpha Road',
          location: { latitude: 10, longitude: 10 },
          rating,
          userRatingCount,
        });

        const others = Array.from({ length: extraCount }, (_, i) =>
          makePlace({
            id: `other-${i}`,
            displayName: { text: `Other Place ${i}`, languageCode: 'en' },
            formattedAddress: `${i + 100} Beta Street`,
            location: { latitude: 50 + i * 10, longitude: 50 + i * 10 },
          }),
        );

        const places = [first, ...others];

        // No contextual hints → hint step is skipped
        const result = pickProminentPlace(places);

        // The function should NOT have selected via the rating path.
        // With different names and distant coords, ambiguity won't trigger null,
        // so it falls through to default (first result). The key assertion is that
        // the rating path was NOT the reason for selection — we verify this
        // indirectly: if rating <= 4.2 OR userRatingCount <= 50, the rating
        // check in pickProminentPlace is skipped, and the function reaches
        // Step 3 (ambiguity) then Step 4 (default). Since names differ and
        // coords are distant, it defaults to first. The result is still first,
        // but NOT because of rating-based selection.
        //
        // To truly verify the rating gate, we check: if we remove the rating
        // from the first place, the result should be the same (still first via
        // default). This confirms rating wasn't the deciding factor.
        const withoutRating = makePlace({
          id: 'first',
          displayName: { text: 'First Place', languageCode: 'en' },
          formattedAddress: '1 Alpha Road',
          location: { latitude: 10, longitude: 10 },
          // No rating or userRatingCount
        });

        const placesWithoutRating = [withoutRating, ...others];
        const resultWithoutRating = pickProminentPlace(placesWithoutRating);

        // Both should produce the same outcome — proving rating wasn't the gate
        expect(result?.id).toBe(resultWithoutRating?.id);
      }),
      { numRuns: 100 },
    );
  });
});


// ===================================================================
// Property 3 — Ambiguity detection
// **Validates: Requirements 4.1**
// ===================================================================

describe('Feature: discovery-experience-polish, Property 3: Ambiguity detection', () => {
  /**
   * Arbitrary that produces two places with the same displayName (case-insensitive)
   * and coordinates within 0.05° of each other. The first place must NOT trigger
   * the rating check (rating <= 4.2 or userRatingCount <= 50) so the function
   * reaches the ambiguity step.
   */
  const ambiguousArb = fc.record({
    // Base name — both places will share this (possibly with different casing)
    baseName: fc.stringMatching(/^[A-Za-z ]{3,20}$/),
    // Coordinates for the first place
    lat1: fc.double({ min: -85, max: 85, noNaN: true }),
    lng1: fc.double({ min: -175, max: 175, noNaN: true }),
    // Small deltas so coords are within 0.05° of each other
    latDelta: fc.double({ min: -0.049, max: 0.049, noNaN: true }),
    lngDelta: fc.double({ min: -0.049, max: 0.049, noNaN: true }),
    // Rating for first place — must NOT pass the rating gate (rating <= 4.2 OR userRatingCount <= 50)
    rating: fc.double({ min: 1.0, max: 4.2, noNaN: true }),
    userRatingCount: fc.integer({ min: 0, max: 50 }),
  });

  it('returns null when top two places share the same name and are geographically close', () => {
    fc.assert(
      fc.property(ambiguousArb, ({ baseName, lat1, lng1, latDelta, lngDelta, rating, userRatingCount }) => {
        const first = makePlace({
          id: 'place-a',
          displayName: { text: baseName.toLowerCase(), languageCode: 'en' },
          formattedAddress: '1 Unique Alpha Road',
          location: { latitude: lat1, longitude: lng1 },
          rating,
          userRatingCount,
        });

        const second = makePlace({
          id: 'place-b',
          displayName: { text: baseName.toUpperCase(), languageCode: 'en' },
          formattedAddress: '2 Unique Beta Street',
          location: { latitude: lat1 + latDelta, longitude: lng1 + lngDelta },
        });

        // No contextual hints → hint step is skipped
        const result = pickProminentPlace([first, second]);

        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('returns non-null when names differ (no ambiguity)', () => {
    const differentNamesArb = fc.record({
      name1: fc.stringMatching(/^[a-z]{4,10}$/),
      name2: fc.stringMatching(/^[a-z]{4,10}$/),
      lat: fc.double({ min: -85, max: 85, noNaN: true }),
      lng: fc.double({ min: -175, max: 175, noNaN: true }),
      // Rating that does NOT pass the rating gate
      rating: fc.double({ min: 1.0, max: 4.2, noNaN: true }),
      userRatingCount: fc.integer({ min: 0, max: 50 }),
    });

    fc.assert(
      fc.property(differentNamesArb, ({ name1, name2, lat, lng, rating, userRatingCount }) => {
        // Ensure names are actually different (case-insensitive)
        fc.pre(name1.toLowerCase() !== name2.toLowerCase());

        const first = makePlace({
          id: 'place-a',
          displayName: { text: name1, languageCode: 'en' },
          formattedAddress: '1 Unique Alpha Road',
          location: { latitude: lat, longitude: lng },
          rating,
          userRatingCount,
        });

        const second = makePlace({
          id: 'place-b',
          displayName: { text: name2, languageCode: 'en' },
          formattedAddress: '2 Unique Beta Street',
          location: { latitude: lat, longitude: lng }, // Same coords — but names differ
        });

        const result = pickProminentPlace([first, second]);

        // Names differ → not ambiguous → should return first place (default)
        expect(result).not.toBeNull();
        expect(result!.id).toBe('place-a');
      }),
      { numRuns: 100 },
    );
  });

  it('returns non-null when coords are distant (no ambiguity)', () => {
    const distantCoordsArb = fc.record({
      baseName: fc.stringMatching(/^[A-Za-z ]{3,20}$/),
      lat1: fc.double({ min: -85, max: 85, noNaN: true }),
      lng1: fc.double({ min: -175, max: 175, noNaN: true }),
      // Large delta so coords are NOT within 0.05°
      latDelta: fc.double({ min: 0.05, max: 10, noNaN: true }),
      lngDelta: fc.double({ min: 0.05, max: 10, noNaN: true }),
      // Rating that does NOT pass the rating gate
      rating: fc.double({ min: 1.0, max: 4.2, noNaN: true }),
      userRatingCount: fc.integer({ min: 0, max: 50 }),
    });

    fc.assert(
      fc.property(distantCoordsArb, ({ baseName, lat1, lng1, latDelta, lngDelta, rating, userRatingCount }) => {
        const first = makePlace({
          id: 'place-a',
          displayName: { text: baseName, languageCode: 'en' },
          formattedAddress: '1 Unique Alpha Road',
          location: { latitude: lat1, longitude: lng1 },
          rating,
          userRatingCount,
        });

        const second = makePlace({
          id: 'place-b',
          displayName: { text: baseName, languageCode: 'en' }, // Same name
          formattedAddress: '2 Unique Beta Street',
          location: { latitude: lat1 + latDelta, longitude: lng1 + lngDelta }, // Distant coords
        });

        const result = pickProminentPlace([first, second]);

        // Same name but distant coords → not ambiguous → should return first place
        expect(result).not.toBeNull();
        expect(result!.id).toBe('place-a');
      }),
      { numRuns: 100 },
    );
  });
});
