import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Bug Condition Exploration Test 1a
 * Validates: Requirements 1.1, 2.1
 *
 * Assert that sensors use MouseSensor (distance: 5) + TouchSensor (delay: 250, tolerance: 8)
 * instead of a single PointerSensor with distance: 5.
 */
describe('usePlannerDnd bug condition', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../hooks/usePlannerDnd.tsx'),
    'utf-8'
  );

  it('1a: uses split MouseSensor + TouchSensor instead of single PointerSensor', () => {
    expect(source).toContain('MouseSensor');
    expect(source).toContain('TouchSensor');
    expect(source).toContain('delay: 250');
    expect(source).toContain('tolerance: 8');
    // Should NOT use the old single PointerSensor
    expect(source).not.toMatch(/useSensor\(PointerSensor/);
  });
});
