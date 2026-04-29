import { describe, it, expect } from 'vitest';
import { detectPlaceEmoji } from '@/utils/extractPlacesUtils';

describe('detectPlaceEmoji', () => {
  // --- Positive cases ---

  it('detects 📍 followed by a place name', () => {
    const lines = ['📍鮨匠 割烹', '好好吃的壽司'];
    const result = detectPlaceEmoji(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('鮨匠 割烹');
    expect(result!.confidence).toBe(0.75);
    expect(result!.pattern).toBe('place_emoji_pin');
    expect(result!.address).toBeNull();
  });

  it('detects 🏠 followed by a place name', () => {
    const lines = ['🏠 Cafe de Coral'];
    const result = detectPlaceEmoji(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Cafe de Coral');
    expect(result!.confidence).toBe(0.75);
    expect(result!.pattern).toBe('place_emoji_pin');
  });

  it('detects 🍽 followed by a place name', () => {
    const lines = ['🍽 添好運點心專門店'];
    const result = detectPlaceEmoji(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('添好運點心專門店');
    expect(result!.confidence).toBe(0.75);
  });

  it('elevates confidence to 0.85 when next line has CJK address markers', () => {
    const lines = [
      '📍一蘭拉麵',
      '銅鑼灣波斯富街99號',
    ];
    const result = detectPlaceEmoji(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('一蘭拉麵');
    expect(result!.confidence).toBe(0.85);
    expect(result!.address).toBe('銅鑼灣波斯富街99號');
  });

  it('elevates confidence when next line contains 地址', () => {
    const lines = [
      '📍添好運',
      '地址：深水埗福華街9號',
    ];
    const result = detectPlaceEmoji(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('添好運');
    expect(result!.confidence).toBe(0.85);
    expect(result!.address).toBe('地址：深水埗福華街9號');
  });

  it('strips trailing hashtags from name', () => {
    const lines = ['📍一蘭拉麵 #銅鑼灣 #拉麵'];
    const result = detectPlaceEmoji(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('一蘭拉麵');
  });

  it('strips trailing punctuation from name', () => {
    const lines = ['📍一蘭拉麵。'];
    const result = detectPlaceEmoji(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('一蘭拉麵');
  });

  it('strips trailing non-Place emoji from name', () => {
    const lines = ['📍一蘭拉麵🔥'];
    const result = detectPlaceEmoji(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('一蘭拉麵');
  });

  it('handles emoji with variation selector (e.g. ⛩️)', () => {
    const lines = ['⛩️ Meiji Shrine'];
    const result = detectPlaceEmoji(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Meiji Shrine');
  });

  // --- Negative cases ---

  it('rejects text shorter than 2 characters after emoji', () => {
    const lines = ['📍X'];
    const result = detectPlaceEmoji(lines);
    expect(result).toBeNull();
  });

  it('rejects text longer than 80 characters after emoji', () => {
    const longText = 'A'.repeat(81);
    const lines = [`📍${longText}`];
    const result = detectPlaceEmoji(lines);
    expect(result).toBeNull();
  });

  it('skips narrative candidates', () => {
    const lines = ['📍終於俾我預約到啦‼️好開心😍😍😍'];
    const result = detectPlaceEmoji(lines);
    expect(result).toBeNull();
  });

  it('returns null when no Place emoji starts any line', () => {
    const lines = [
      '今天去了一家很好吃的餐廳',
      '推薦大家去試試',
    ];
    const result = detectPlaceEmoji(lines);
    expect(result).toBeNull();
  });

  it('returns null for empty lines array', () => {
    const result = detectPlaceEmoji([]);
    expect(result).toBeNull();
  });

  it('skips line where emoji is not at the start', () => {
    const lines = ['去了 📍一蘭拉麵'];
    const result = detectPlaceEmoji(lines);
    expect(result).toBeNull();
  });
});
