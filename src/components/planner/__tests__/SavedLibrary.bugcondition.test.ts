import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Bug Condition Exploration Test 1e
 * Validates: Requirements 1.4, 2.4
 *
 * Assert that PinCard uses motion.div with whileTap prop.
 * EXPECTED TO FAIL on unfixed code because PinCard uses a plain div.
 */
describe('SavedLibrary PinCard bug condition', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../../components/planner/SavedLibrary.tsx'),
    'utf-8'
  );

  it('1e: PinCard renders as motion.div with whileTap prop', () => {
    // The PinCard component should use motion.div instead of plain div
    expect(source).toContain('motion.div');
    expect(source).toContain('whileTap');
  });
});
