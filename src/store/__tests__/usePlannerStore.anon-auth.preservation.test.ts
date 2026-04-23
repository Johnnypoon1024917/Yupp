import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Preservation Test — Anonymous Auth Bypass Fix in usePlannerStore
 * **Validates: Requirements 3.2, 3.3, 3.5, 3.6**
 *
 * Verifies that the fixed auth guards in `createItinerary` and `cloneItinerary`
 * preserve existing behavior for registered users and null users:
 * - The `!user` check is still present (null-user blocking preserved)
 * - The `is_anonymous` check was added (the fix)
 * - The guard uses `||` (OR) to combine both conditions
 */
describe('usePlannerStore anon-auth preservation', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../store/usePlannerStore.ts'),
    'utf-8',
  );

  describe('createItinerary auth guard', () => {
    const createStart = source.indexOf('createItinerary: async');
    const createWindow = source.slice(createStart, createStart + 400);

    it('still includes !user check for null-user blocking', () => {
      expect(createWindow).toMatch(/!user/);
    });

    it('includes is_anonymous check (the fix)', () => {
      expect(createWindow).toMatch(/is_anonymous/);
    });

    it('combines !user and is_anonymous with OR (||)', () => {
      expect(createWindow).toMatch(/if\s*\(\s*!user\s*\|\|\s*user\.is_anonymous\s*\)/);
    });
  });

  describe('cloneItinerary auth guard', () => {
    const cloneStart = source.indexOf('cloneItinerary: async');
    const cloneWindow = source.slice(cloneStart, cloneStart + 500);

    it('still includes !user check for null-user blocking', () => {
      expect(cloneWindow).toMatch(/!user/);
    });

    it('includes is_anonymous check (the fix)', () => {
      expect(cloneWindow).toMatch(/is_anonymous/);
    });

    it('combines !user and is_anonymous with OR (||)', () => {
      expect(cloneWindow).toMatch(/if\s*\(\s*!user\s*\|\|\s*user\.is_anonymous\s*\)/);
    });
  });
});
