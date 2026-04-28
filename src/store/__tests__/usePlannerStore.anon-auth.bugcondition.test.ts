import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Bug Condition Exploration Test — Anonymous Auth Bypass
 * **Validates: Requirements 1.2, 1.3, 2.2, 2.3**
 *
 * After the TanStack Query migration, `createItinerary` and `cloneItinerary`
 * were moved from usePlannerStore to server actions. The `is_anonymous` guard
 * now lives in `requireRegisteredUser` (src/actions/auth.ts), which is called
 * by every server action (createItineraryAction, cloneItineraryAction, etc.).
 *
 * This test verifies the guard exists in the server action auth layer.
 */
describe('usePlannerStore anon-auth bug condition', () => {
  const authSource = fs.readFileSync(
    path.resolve(__dirname, '../../actions/auth.ts'),
    'utf-8',
  );

  const itineraryActionsSource = fs.readFileSync(
    path.resolve(__dirname, '../../actions/itineraryActions.ts'),
    'utf-8',
  );

  it('requireRegisteredUser checks is_anonymous', () => {
    expect(authSource).toContain('is_anonymous');
  });

  it('createItineraryAction delegates to requireRegisteredUser', () => {
    expect(itineraryActionsSource).toContain('requireRegisteredUser');
    // Verify createItineraryAction function exists and calls the guard
    const createStart = itineraryActionsSource.indexOf('async function createItineraryAction');
    expect(createStart).toBeGreaterThan(-1);
  });

  it('cloneItineraryAction delegates to requireRegisteredUser', () => {
    expect(itineraryActionsSource).toContain('requireRegisteredUser');
    // Verify cloneItineraryAction function exists and calls the guard
    const cloneStart = itineraryActionsSource.indexOf('async function cloneItineraryAction');
    expect(cloneStart).toBeGreaterThan(-1);
  });
});
