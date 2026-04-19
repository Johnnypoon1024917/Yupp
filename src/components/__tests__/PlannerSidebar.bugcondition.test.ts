import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Bug Condition Exploration Tests 1c & 1d
 * Validates: Requirements 1.3, 1.5, 2.3, 2.5
 *
 * Test 1c: Assert source does NOT contain onPointerEnter/onPointerLeave handlers
 * Test 1d: Assert source DOES contain onPointerMove with stopPropagation
 * Both EXPECTED TO FAIL on unfixed code.
 */
describe('PlannerSidebar bug condition', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../components/PlannerSidebar.tsx'),
    'utf-8'
  );

  it('1c: does NOT have onPointerEnter or onPointerLeave handlers', () => {
    expect(source).not.toContain('onPointerEnter');
    expect(source).not.toContain('onPointerLeave');
  });

  it('1d: does NOT have onPointerMove stopPropagation (events must bubble to dnd-kit)', () => {
    // onPointerMove stopPropagation was removed because it blocks dnd-kit drag tracking.
    // Map is locked via disableInteractions() during drag instead.
    expect(source).not.toMatch(/onPointerMove.*stopPropagation/s);
  });
});
