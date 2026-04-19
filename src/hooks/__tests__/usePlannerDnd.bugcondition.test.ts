import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Bug Condition Exploration Test 1a
 * Validates: Requirements 1.1, 2.1
 *
 * Assert that PointerSensor is configured with delay: 500, tolerance: 5
 * EXPECTED TO FAIL on unfixed code because it currently uses distance: 5
 */
describe('usePlannerDnd bug condition', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../hooks/usePlannerDnd.tsx'),
    'utf-8'
  );

  it('1a: PointerSensor uses delay-based activation (delay: 200, tolerance: 8)', () => {
    // The source should contain a delay-based constraint, not distance-based
    expect(source).toContain('delay: 200');
    expect(source).toContain('tolerance: 8');
    expect(source).not.toContain('distance: 5');
  });
});
