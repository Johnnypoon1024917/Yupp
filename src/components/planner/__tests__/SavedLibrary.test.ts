import { describe, it, expect } from 'vitest';
import { extractRegion, groupPinsByRegion, filterPins } from '../SavedLibrary';
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

describe('extractRegion', () => {
  it('returns last comma-separated segment', () => {
    expect(extractRegion('123 Main St, Tokyo, Japan')).toBe('Japan');
  });

  it('returns the whole string when no commas', () => {
    expect(extractRegion('Japan')).toBe('Japan');
  });

  it('returns "Unknown Location" for undefined address', () => {
    expect(extractRegion(undefined)).toBe('Unknown Location');
  });

  it('returns "Unknown Location" for empty string', () => {
    expect(extractRegion('')).toBe('Unknown Location');
  });

  it('returns "Unknown Location" for whitespace-only string', () => {
    expect(extractRegion('   ')).toBe('Unknown Location');
  });

  it('trims whitespace from the segment', () => {
    expect(extractRegion('Street,  Indonesia  ')).toBe('Indonesia');
  });
});

describe('groupPinsByRegion', () => {
  it('groups pins by their derived region', () => {
    const pins = [
      makePin({ id: '1', address: 'Shibuya, Tokyo, Japan' }),
      makePin({ id: '2', address: 'Shinjuku, Tokyo, Japan' }),
      makePin({ id: '3', address: 'Ubud, Bali, Indonesia' }),
    ];
    const groups = groupPinsByRegion(pins);
    expect(Object.keys(groups).sort()).toEqual(['Indonesia', 'Japan']);
    expect(groups['Japan']).toHaveLength(2);
    expect(groups['Indonesia']).toHaveLength(1);
  });

  it('places pins without address in "Unknown Location"', () => {
    const pins = [makePin({ id: '1' })];
    const groups = groupPinsByRegion(pins);
    expect(groups['Unknown Location']).toHaveLength(1);
  });

  it('returns empty object for empty array', () => {
    expect(groupPinsByRegion([])).toEqual({});
  });

  it('every pin appears in exactly one group', () => {
    const pins = [
      makePin({ id: '1', address: 'A, Japan' }),
      makePin({ id: '2', address: 'B, Japan' }),
      makePin({ id: '3', address: 'C, France' }),
    ];
    const groups = groupPinsByRegion(pins);
    const total = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(pins.length);
  });
});

describe('filterPins', () => {
  const pins = [
    makePin({ id: '1', title: 'Eiffel Tower', address: 'Paris, France' }),
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

  it('filters by address (case-insensitive)', () => {
    const result = filterPins(pins, 'japan');
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
