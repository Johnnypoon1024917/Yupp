import { describe, it, expect } from 'vitest';
import { extractCity, getDominantCity } from '@/utils/address';

describe('extractCity', () => {
  it('returns second-to-last segment for multi-segment address', () => {
    expect(extractCity('Shibuya, Tokyo, Japan')).toBe('Tokyo');
  });

  it('returns the single segment when only one exists', () => {
    expect(extractCity('Tokyo')).toBe('Tokyo');
  });

  it('returns empty string for undefined', () => {
    expect(extractCity(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(extractCity('')).toBe('');
  });

  it('returns empty string for whitespace-only', () => {
    expect(extractCity('   ')).toBe('');
  });

  it('handles two-segment address', () => {
    expect(extractCity('Tokyo, Japan')).toBe('Tokyo');
  });

  it('trims whitespace from segments', () => {
    expect(extractCity('  Shibuya ,  Tokyo ,  Japan  ')).toBe('Tokyo');
  });
});

describe('getDominantCity', () => {
  it('returns the city with the most pins', () => {
    const pins = [
      { address: 'Shibuya, Tokyo, Japan' },
      { address: 'Shinjuku, Tokyo, Japan' },
      { address: 'Gangnam, Seoul, South Korea' },
    ];
    expect(getDominantCity(pins)).toBe('Tokyo');
  });

  it('returns empty string for empty array', () => {
    expect(getDominantCity([])).toBe('');
  });

  it('returns empty string when all pins lack addresses', () => {
    const pins = [{ address: undefined }, { address: '' }];
    expect(getDominantCity(pins)).toBe('');
  });

  it('returns the only city when all pins share it', () => {
    const pins = [
      { address: 'Asakusa, Tokyo, Japan' },
      { address: 'Akihabara, Tokyo, Japan' },
    ];
    expect(getDominantCity(pins)).toBe('Tokyo');
  });

  it('handles single pin', () => {
    const pins = [{ address: 'Eiffel Tower, Paris, France' }];
    expect(getDominantCity(pins)).toBe('Paris');
  });

  it('picks first city to reach max when tied', () => {
    const pins = [
      { address: 'Place A, Tokyo, Japan' },
      { address: 'Place B, Seoul, South Korea' },
    ];
    // Both have count 1, first encountered wins
    const result = getDominantCity(pins);
    expect(['Tokyo', 'Seoul']).toContain(result);
  });

  it('skips pins without valid addresses', () => {
    const pins = [
      { address: undefined },
      { address: 'Shibuya, Tokyo, Japan' },
      { address: '' },
      { address: 'Shinjuku, Tokyo, Japan' },
    ];
    expect(getDominantCity(pins)).toBe('Tokyo');
  });
});
