import { describe, it, expect } from 'vitest';
import {
  getCollectionForType,
  getKnownCollectionNames,
  getCategoryIcon,
  getCategoryGradient,
} from '../categories';

// ---------------------------------------------------------------------------
// Requirement 1.1 — "restaurant", "cafe", "bar", "bakery" → "Food & Drink"
// ---------------------------------------------------------------------------

describe('Requirement 1.1: Food & Drink mappings', () => {
  it.each(['restaurant', 'cafe', 'bar', 'bakery'])(
    'maps "%s" to "Food & Drink"',
    (type) => {
      expect(getCollectionForType(type)).toBe('Food & Drink');
    },
  );
});

// ---------------------------------------------------------------------------
// Requirement 1.2 — "hotel", "lodging", "apartment" → "Accommodations"
// ---------------------------------------------------------------------------

describe('Requirement 1.2: Accommodations mappings', () => {
  it.each(['hotel', 'lodging', 'apartment'])(
    'maps "%s" to "Accommodations"',
    (type) => {
      expect(getCollectionForType(type)).toBe('Accommodations');
    },
  );
});

// ---------------------------------------------------------------------------
// Requirement 1.3 — "tourist_attraction", "museum", "park", "zoo" → "Sightseeing"
// ---------------------------------------------------------------------------

describe('Requirement 1.3: Sightseeing mappings', () => {
  it.each(['tourist_attraction', 'museum', 'park', 'zoo'])(
    'maps "%s" to "Sightseeing"',
    (type) => {
      expect(getCollectionForType(type)).toBe('Sightseeing');
    },
  );
});

// ---------------------------------------------------------------------------
// Requirement 1.4 — "shopping_mall", "store" → "Shopping"
// ---------------------------------------------------------------------------

describe('Requirement 1.4: Shopping mappings', () => {
  it.each(['shopping_mall', 'store'])(
    'maps "%s" to "Shopping"',
    (type) => {
      expect(getCollectionForType(type)).toBe('Shopping');
    },
  );
});

// ---------------------------------------------------------------------------
// Requirement 1.5 — Unknown types → "Unorganized"
// ---------------------------------------------------------------------------

describe('Requirement 1.5: Unknown types fall back to Unorganized', () => {
  it.each(['gym', 'library', 'gas_station', 'unknown_type'])(
    'maps unknown type "%s" to "Unorganized"',
    (type) => {
      expect(getCollectionForType(type)).toBe('Unorganized');
    },
  );
});

// ---------------------------------------------------------------------------
// Requirement 1.6 — Empty string, undefined → "Unorganized"
// ---------------------------------------------------------------------------

describe('Requirement 1.6: Edge cases', () => {
  it('returns "Unorganized" for an empty string', () => {
    expect(getCollectionForType('')).toBe('Unorganized');
  });

  it('returns "Unorganized" for undefined', () => {
    expect(getCollectionForType(undefined)).toBe('Unorganized');
  });
});

// ---------------------------------------------------------------------------
// getKnownCollectionNames — sanity check
// ---------------------------------------------------------------------------

describe('getKnownCollectionNames', () => {
  it('returns a set containing all five collection names', () => {
    const names = getKnownCollectionNames();
    expect(names).toContain('Food & Drink');
    expect(names).toContain('Accommodations');
    expect(names).toContain('Sightseeing');
    expect(names).toContain('Shopping');
    expect(names).toContain('Unorganized');
    expect(names.size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// getCategoryIcon — spot checks
// ---------------------------------------------------------------------------

describe('getCategoryIcon', () => {
  it('returns "utensils" for Food & Drink', () => {
    expect(getCategoryIcon('Food & Drink')).toBe('utensils');
  });

  it('returns "map-pin" for an unknown collection name', () => {
    expect(getCategoryIcon('Nonexistent')).toBe('map-pin');
  });
});

// ---------------------------------------------------------------------------
// getCategoryGradient — spot checks
// ---------------------------------------------------------------------------

describe('getCategoryGradient', () => {
  it('returns an orange-rose gradient for Food & Drink', () => {
    expect(getCategoryGradient('Food & Drink')).toContain('from-orange-400');
  });

  it('returns a gray-slate gradient for an unknown collection name', () => {
    expect(getCategoryGradient('Nonexistent')).toContain('from-gray-400');
  });
});
