import { describe, it, expect } from 'vitest';
import { detectEnglishTitleSeparator } from '@/utils/extractPlacesUtils';

describe('detectEnglishTitleSeparator', () => {
  // --- Positive cases ---

  it('extracts name before ASCII pipe separator', () => {
    const lines = ['Best Ramen in Tokyo | Food Guide'];
    const result = detectEnglishTitleSeparator(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Best Ramen in Tokyo');
    expect(result!.confidence).toBe(0.6);
    expect(result!.pattern).toBe('english_title_separator');
    expect(result!.address).toBeNull();
    expect(result!.districtHint).toBeNull();
  });

  it('extracts name before full-width pipe ｜', () => {
    const lines = ['Sushi Dai｜Tsukiji Market'];
    const result = detectEnglishTitleSeparator(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Sushi Dai');
    expect(result!.confidence).toBe(0.6);
  });

  it('extracts name before middle dot ·', () => {
    const lines = ['Cafe Latte · Downtown Seattle'];
    const result = detectEnglishTitleSeparator(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Cafe Latte');
  });

  it('extracts name before em dash —', () => {
    const lines = ['The French Laundry — Napa Valley'];
    const result = detectEnglishTitleSeparator(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('The French Laundry');
  });

  it('extracts name before en dash –', () => {
    const lines = ['Nobu Restaurant – Malibu'];
    const result = detectEnglishTitleSeparator(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Nobu Restaurant');
  });

  it('extracts name before hyphen -', () => {
    const lines = ['Din Tai Fung - Taipei 101'];
    const result = detectEnglishTitleSeparator(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Din Tai Fung');
  });

  it('skips empty lines and matches the first non-empty line', () => {
    const lines = ['', '  ', 'Ichiran Ramen | Shibuya'];
    const result = detectEnglishTitleSeparator(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Ichiran Ramen');
  });

  // --- Negative cases ---

  it('rejects candidate shorter than 2 characters', () => {
    const lines = ['X | Some Restaurant Guide'];
    const result = detectEnglishTitleSeparator(lines);
    expect(result).toBeNull();
  });

  it('rejects candidate longer than 80 characters', () => {
    const longName = 'A'.repeat(81);
    const lines = [`${longName} | Guide`];
    const result = detectEnglishTitleSeparator(lines);
    expect(result).toBeNull();
  });

  it('rejects narrative candidates', () => {
    const lines = ['終於俾我預約到啦‼️ | 好開心😍😍😍'];
    const result = detectEnglishTitleSeparator(lines);
    expect(result).toBeNull();
  });

  it('returns null when no separator is present', () => {
    const lines = ['Just a plain title with no separators'];
    const result = detectEnglishTitleSeparator(lines);
    expect(result).toBeNull();
  });

  it('returns null for empty lines array', () => {
    const result = detectEnglishTitleSeparator([]);
    expect(result).toBeNull();
  });

  it('returns null when separator is at the start (empty candidate)', () => {
    const lines = ['| Some text after pipe'];
    const result = detectEnglishTitleSeparator(lines);
    expect(result).toBeNull();
  });
});
