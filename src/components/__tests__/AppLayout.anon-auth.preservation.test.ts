import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Preservation Test — Anonymous Auth Bypass Fix in AppLayout
 * **Validates: Requirements 3.1, 3.4**
 *
 * Verifies that the fixed auth guard in `handleTabChange` preserves existing
 * behavior for registered users and null users:
 * - The `!user` check is still present (null-user blocking preserved)
 * - The `is_anonymous` check was added (the fix)
 * - The guard uses `||` (OR) to combine both conditions
 */
describe('AppLayout anon-auth preservation', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../components/AppLayout.tsx'),
    'utf-8',
  );

  // Extract the handleTabChange planner-tab auth guard window
  const handleTabChangeStart = source.indexOf('const handleTabChange');
  const planCheckIndex = source.indexOf("tab === 'plan'", handleTabChangeStart);
  const guardWindow = source.slice(planCheckIndex, planCheckIndex + 400);

  it('auth guard still includes !user check for null-user blocking', () => {
    // The guard must retain `!user` so that null users are still blocked
    expect(guardWindow).toMatch(/!user/);
  });

  it('auth guard includes is_anonymous check (the fix)', () => {
    // The guard must now also check `is_anonymous`
    expect(guardWindow).toMatch(/is_anonymous/);
  });

  it('auth guard combines !user and is_anonymous with OR (||)', () => {
    // The full guard pattern should be `if (!user || user.is_anonymous)`
    // Match the pattern allowing for optional whitespace variations
    expect(guardWindow).toMatch(/if\s*\(\s*!user\s*\|\|\s*user\.is_anonymous\s*\)/);
  });
});
