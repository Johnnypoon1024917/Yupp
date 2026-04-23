import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Bug Condition Exploration Test — Anonymous Auth Bypass in usePlannerStore
 * **Validates: Requirements 1.2, 1.3, 2.2, 2.3**
 *
 * Asserts that both `createItinerary` and `cloneItinerary` in usePlannerStore.ts
 * check `is_anonymous` in their auth guards. This test is EXPECTED TO FAIL
 * on unfixed code where the guards are only `if (!user)`.
 */
describe('usePlannerStore anon-auth bug condition', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../store/usePlannerStore.ts'),
    'utf-8',
  );

  it('createItinerary auth guard checks is_anonymous', () => {
    // Find the createItinerary implementation (async function body, not the type declaration)
    const createStart = source.indexOf('createItinerary: async');
    expect(createStart).toBeGreaterThan(-1);

    // Extract a window after the function start to find the auth guard
    // The guard appears shortly after `getUser()` call
    const createWindow = source.slice(createStart, createStart + 400);

    // The auth guard should include an is_anonymous check.
    // On unfixed code this will be just `if (!user)` — no is_anonymous.
    expect(createWindow).toMatch(/is_anonymous/);
  });

  it('cloneItinerary auth guard checks is_anonymous', () => {
    // Find the cloneItinerary implementation (async function body, not the type declaration)
    const cloneStart = source.indexOf('cloneItinerary: async');
    expect(cloneStart).toBeGreaterThan(-1);

    // Extract a window after the function start to find the auth guard
    const cloneWindow = source.slice(cloneStart, cloneStart + 500);

    // The auth guard should include an is_anonymous check.
    // On unfixed code this will be just `if (!user)` — no is_anonymous.
    expect(cloneWindow).toMatch(/is_anonymous/);
  });
});
