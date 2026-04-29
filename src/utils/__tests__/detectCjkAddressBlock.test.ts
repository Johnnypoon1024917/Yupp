import { describe, it, expect } from 'vitest';
import { detectCjkAddressBlock } from '@/utils/extractPlacesUtils';

describe('detectCjkAddressBlock', () => {
  it('detects Traditional Chinese address block with name line', () => {
    const lines = [
      '終於俾我預約到啦‼️',
      '鮨匠 割烹 （尖沙咀）',
      '地址：尖沙咀彌敦道100號',
      '電話：2345-6789',
    ];
    const result = detectCjkAddressBlock(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('鮨匠 割烹');
    expect(result!.address).toBe('尖沙咀彌敦道100號');
    expect(result!.districtHint).toBe('尖沙咀');
    expect(result!.confidence).toBe(0.9);
    expect(result!.pattern).toBe('cjk_address_block');
  });

  it('detects Simplified Chinese address block', () => {
    const lines = [
      '好吃的火锅店',
      '地址: 北京市朝阳区三里屯路19号',
      '电话: 010-12345678',
    ];
    const result = detectCjkAddressBlock(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('好吃的火锅店');
    expect(result!.address).toBe('北京市朝阳区三里屯路19号');
    expect(result!.confidence).toBe(0.9);
  });

  it('accepts ASCII colon with whitespace', () => {
    const lines = [
      '小籠包專門店',
      '地址 : 台北市信義區松壽路12號',
    ];
    const result = detectCjkAddressBlock(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('小籠包專門店');
    expect(result!.address).toBe('台北市信義區松壽路12號');
  });

  it('skips narrative name lines and looks back further', () => {
    const lines = [
      '真正的好店',
      '終於俾我預約到啦‼️',
      '地址：尖沙咀彌敦道100號',
    ];
    const result = detectCjkAddressBlock(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('真正的好店');
  });

  it('skips name lines matching ogTitle (case-insensitive)', () => {
    const lines = [
      '鮨匠 割烹',
      'FoodBlogger',
      '地址：尖沙咀彌敦道100號',
    ];
    const result = detectCjkAddressBlock(lines, 'foodblogger');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('鮨匠 割烹');
  });

  it('returns null when no address line found', () => {
    const lines = [
      '今天去了一家很好吃的餐廳',
      '推薦大家去試試',
    ];
    const result = detectCjkAddressBlock(lines);
    expect(result).toBeNull();
  });

  it('returns null when no valid name candidate within 3 lines', () => {
    const lines = [
      '好店推薦',
      '',
      '',
      '',
      '地址：尖沙咀彌敦道100號',
    ];
    // The address is at index 4, look-back 3 lines: indices 3, 2, 1 — all empty
    const result = detectCjkAddressBlock(lines);
    expect(result).toBeNull();
  });

  it('extracts district hint from parenthesized content', () => {
    const lines = [
      '一蘭拉麵（銅鑼灣）',
      '地址：銅鑼灣波斯富街99號',
    ];
    const result = detectCjkAddressBlock(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('一蘭拉麵');
    expect(result!.districtHint).toBe('銅鑼灣');
  });

  it('handles full-width parentheses for district hint', () => {
    const lines = [
      '添好運(深水埗)',
      '地址：深水埗福華街9號',
    ];
    const result = detectCjkAddressBlock(lines);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('添好運');
    expect(result!.districtHint).toBe('深水埗');
  });

  it('returns null when address line is at index 0 (no look-back possible)', () => {
    const lines = [
      '地址：尖沙咀彌敦道100號',
    ];
    const result = detectCjkAddressBlock(lines);
    expect(result).toBeNull();
  });
});
