import { describe, it, expect } from 'vitest';
import { extractCity, groupPinsByCity, filterPins } from '../LibraryPane';
import type { Pin } from '@/types';

function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: overrides.id ?? '1',
    title: overrides.title ?? 'Test Pin',
    imageUrl: overrides.imageUrl ?? 'https://example.com/img.jpg',
    sourceUrl: overrides.sourceUrl ?? 'https://example.com',
    latitude: overrides.latitude ?? 0,
    longitude: overrides.longitude ?? 0,
    collectionId: overrides.collectionId ?? 'unorganized',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    address: overrides.address,
  };
}

describe('extractCity', () => {
  it('returns second-to-last comma-separated segment as city', () => {
    expect(extractCity('123 Main St, Tokyo, Japan')).toBe('Tokyo');
  });

  it('returns the whole string when no commas (single segment)', () => {
    expect(extractCity('Japan')).toBe('Japan');
  });

  it('returns "Unknown Location" for undefined address', () => {
    expect(extractCity(undefined)).toBe('Unknown Location');
  });

  it('returns "Unknown Location" for empty string', () => {
    expect(extractCity('')).toBe('Unknown Location');
  });

  it('returns "Unknown Location" for whitespace-only string', () => {
    expect(extractCity('   ')).toBe('Unknown Location');
  });

  it('trims whitespace from the segment', () => {
    expect(extractCity('Street,  Bali  , Indonesia')).toBe('Bali');
  });

  it('returns first segment when only two segments', () => {
    expect(extractCity('Tokyo, Japan')).toBe('Tokyo');
  });
});

describe('groupPinsByCity', () => {
  it('groups pins by their derived city', () => {
    const pins = [
      makePin({ id: '1', address: 'Shibuya, Tokyo, Japan' }),
      makePin({ id: '2', address: 'Shinjuku, Tokyo, Japan' }),
      makePin({ id: '3', address: 'Ubud, Bali, Indonesia' }),
    ];
    const groups = groupPinsByCity(pins);
    expect(Object.keys(groups).sort()).toEqual(['Bali', 'Tokyo']);
    expect(groups['Tokyo']).toHaveLength(2);
    expect(groups['Bali']).toHaveLength(1);
  });

  it('places pins without address in "Unknown Location"', () => {
    const pins = [makePin({ id: '1' })];
    const groups = groupPinsByCity(pins);
    expect(groups['Unknown Location']).toHaveLength(1);
  });

  it('returns empty object for empty array', () => {
    expect(groupPinsByCity([])).toEqual({});
  });

  it('every pin appears in exactly one group', () => {
    const pins = [
      makePin({ id: '1', address: 'A, Tokyo, Japan' }),
      makePin({ id: '2', address: 'B, Tokyo, Japan' }),
      makePin({ id: '3', address: 'C, Paris, France' }),
    ];
    const groups = groupPinsByCity(pins);
    const total = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(pins.length);
  });
});

describe('filterPins', () => {
  const pins = [
    makePin({ id: '1', title: 'Eiffel Tower', address: 'Champ de Mars, Paris, France' }),
    makePin({ id: '2', title: 'Tokyo Tower', address: 'Minato, Tokyo, Japan' }),
    makePin({ id: '3', title: 'Bali Beach', address: 'Kuta, Bali, Indonesia' }),
  ];

  it('returns all pins for empty query', () => {
    expect(filterPins(pins, '')).toHaveLength(3);
    expect(filterPins(pins, '   ')).toHaveLength(3);
  });

  it('filters by title (case-insensitive)', () => {
    const result = filterPins(pins, 'tower');
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id).sort()).toEqual(['1', '2']);
  });

  it('filters by city name (case-insensitive)', () => {
    const result = filterPins(pins, 'tokyo');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('returns empty array when nothing matches', () => {
    expect(filterPins(pins, 'zzzzz')).toHaveLength(0);
  });

  it('handles pins with no address gracefully', () => {
    const pinsNoAddr = [makePin({ id: '1', title: 'Cafe' })];
    expect(filterPins(pinsNoAddr, 'cafe')).toHaveLength(1);
    expect(filterPins(pinsNoAddr, 'tokyo')).toHaveLength(0);
  });
});
