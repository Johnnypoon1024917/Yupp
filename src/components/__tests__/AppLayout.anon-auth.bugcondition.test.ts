import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Bug Condition Exploration Test — Anonymous Auth Bypass in AppLayout
 * **Validates: Requirements 1.1, 2.1**
 *
 * Asserts that the `handleTabChange` function in AppLayout.tsx checks
 * `is_anonymous` in its planner tab auth guard. This test is EXPECTED TO FAIL
 * on unfixed code where the guard is only `if (!user)`.
 */
describe('AppLayout anon-auth bug condition', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../components/AppLayout.tsx'),
    'utf-8',
  );

  it('handleTabChange planner tab auth guard checks is_anonymous', () => {
    // Extract the handleTabChange function body from source
    const handleTabChangeStart = source.indexOf('const handleTabChange');
    expect(handleTabChangeStart).toBeGreaterThan(-1);

    // Get the section of code around the planner tab auth guard
    // The guard is inside the `if (tab === 'plan')` block
    const planCheckIndex = source.indexOf("tab === 'plan'", handleTabChangeStart);
    expect(planCheckIndex).toBeGreaterThan(-1);

    // Extract a reasonable window after the plan tab check to find the auth guard
    const guardWindow = source.slice(planCheckIndex, planCheckIndex + 400);

    // The auth guard should include an is_anonymous check.
    // On unfixed code this will be just `if (!user)` — no is_anonymous.
    // On fixed code it should be `if (!user || user.is_anonymous)`.
    expect(guardWindow).toMatch(/is_anonymous/);
  });
});
