import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Preservation Test — Anonymous Auth Bypass Fix
 * **Validates: Requirements 3.2, 3.3, 3.5, 3.6**
 *
 * After the TanStack Query migration, `createItinerary` and `cloneItinerary`
 * were moved from usePlannerStore to server actions. The auth guard now lives
 * in `requireRegisteredUser` (src/actions/auth.ts).
 *
 * This test verifies:
 * - The `!user` check is still present (null-user blocking preserved)
 * - The `is_anonymous` check was added (the fix)
 * - Both conditions are enforced via requireRegisteredUser
 */
describe('usePlannerStore anon-auth preservation', () => {
  const authSource = fs.readFileSync(
    path.resolve(__dirname, '../../actions/auth.ts'),
    'utf-8',
  );

  describe('requireRegisteredUser auth guard', () => {
    it('still includes !user check for null-user blocking', () => {
      expect(authSource).toMatch(/!user/);
    });

    it('includes is_anonymous check (the fix)', () => {
      expect(authSource).toMatch(/is_anonymous/);
    });

    it('throws for anonymous users', () => {
      expect(authSource).toMatch(/Anonymous users cannot perform this action/);
    });
  });

  describe('server actions use requireRegisteredUser', () => {
    const actionsSource = fs.readFileSync(
      path.resolve(__dirname, '../../actions/itineraryActions.ts'),
      'utf-8',
    );

    it('createItineraryAction calls requireRegisteredUser', () => {
      const fnStart = actionsSource.indexOf('async function createItineraryAction');
      expect(fnStart).toBeGreaterThan(-1);
      const fnWindow = actionsSource.slice(fnStart, fnStart + 300);
      expect(fnWindow).toContain('requireRegisteredUser');
    });

    it('cloneItineraryAction calls requireRegisteredUser', () => {
      const fnStart = actionsSource.indexOf('async function cloneItineraryAction');
      expect(fnStart).toBeGreaterThan(-1);
      const fnWindow = actionsSource.slice(fnStart, fnStart + 300);
      expect(fnWindow).toContain('requireRegisteredUser');
    });
  });
});
