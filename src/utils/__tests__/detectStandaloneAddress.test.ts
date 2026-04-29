import { describe, it, expect } from 'vitest';
import { detectStandaloneAddress } from '@/utils/extractPlacesUtils';

describe('detectStandaloneAddress', () => {
  describe('CJK address lines', () => {
    it('matches a Traditional Chinese address with ≥ 2 markers and a digit', () => {
      const result = detectStandaloneAddress([
        '台北市大安區忠孝東路4段100號',
      ]);
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.55);
      expect(result!.pattern).toBe('standalone_address');
      expect(result!.address).toBe('台北市大安區忠孝東路4段100號');
      expect(result!.name).toBe('台北市大安區忠孝東路4段100號');
    });

    it('matches a Simplified Chinese address', () => {
      const result = detectStandaloneAddress([
        '上海市浦东新区陆家嘴路168号',
      ]);
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.55);
      expect(result!.pattern).toBe('standalone_address');
      expect(result!.address).toBe('上海市浦东新区陆家嘴路168号');
    });

    it('matches a Hong Kong address with 道 and 號', () => {
      const result = detectStandaloneAddress([
        '尖沙咀彌敦道132號',
      ]);
      expect(result).not.toBeNull();
      expect(result!.pattern).toBe('standalone_address');
    });

    it('rejects a CJK line with only 1 address marker', () => {
      const result = detectStandaloneAddress([
        '東京都渋谷3丁目',
      ]);
      expect(result).toBeNull();
    });

    it('rejects a CJK line with markers but no digit', () => {
      const result = detectStandaloneAddress([
        '台北市大安區忠孝東路',
      ]);
      expect(result).toBeNull();
    });
  });

  describe('English address lines', () => {
    it('matches a standard US street address', () => {
      const result = detectStandaloneAddress([
        '123 Main Street, New York',
      ]);
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.55);
      expect(result!.pattern).toBe('standalone_address');
      expect(result!.address).toBe('123 Main Street, New York');
    });

    it('matches an address with abbreviated street type', () => {
      const result = detectStandaloneAddress([
        '456 Oak Blvd Suite 200',
      ]);
      expect(result).not.toBeNull();
      expect(result!.pattern).toBe('standalone_address');
    });

    it('matches an address with Avenue', () => {
      const result = detectStandaloneAddress([
        '789 Fifth Avenue',
      ]);
      expect(result).not.toBeNull();
      expect(result!.pattern).toBe('standalone_address');
    });

    it('rejects a line without a digit before street word', () => {
      const result = detectStandaloneAddress([
        'Main Street is beautiful',
      ]);
      expect(result).toBeNull();
    });

    it('rejects a line with no street-type word', () => {
      const result = detectStandaloneAddress([
        '123 Maple',
      ]);
      expect(result).toBeNull();
    });
  });

  describe('general behavior', () => {
    it('returns null for empty lines', () => {
      const result = detectStandaloneAddress(['', '  ']);
      expect(result).toBeNull();
    });

    it('returns null for empty array', () => {
      const result = detectStandaloneAddress([]);
      expect(result).toBeNull();
    });

    it('returns the first matching line when multiple exist', () => {
      const result = detectStandaloneAddress([
        'Some narrative text',
        '台北市信義區松仁路100號',
        '456 Elm Drive',
      ]);
      expect(result).not.toBeNull();
      expect(result!.address).toBe('台北市信義區松仁路100號');
    });

    it('always sets districtHint to null', () => {
      const result = detectStandaloneAddress([
        '123 Broadway Avenue',
      ]);
      expect(result).not.toBeNull();
      expect(result!.districtHint).toBeNull();
    });
  });
});
