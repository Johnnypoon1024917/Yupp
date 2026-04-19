import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Bug Condition Exploration Test 1f
 * Validates: Requirements 1.6, 2.6
 *
 * Assert that disableInteractions includes touchPitch.disable()
 * and enableInteractions includes touchPitch.enable().
 * EXPECTED TO FAIL on unfixed code because touchPitch is omitted.
 */
describe('MapView bug condition', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../components/MapView.tsx'),
    'utf-8'
  );

  it('1f: disableInteractions calls touchPitch.disable() and enableInteractions calls touchPitch.enable()', () => {
    expect(source).toContain('touchPitch.disable()');
    expect(source).toContain('touchPitch.enable()');
  });
});
