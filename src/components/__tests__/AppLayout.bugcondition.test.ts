import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Bug Condition Exploration Test 1b
 * Validates: Requirements 1.2, 2.2
 *
 * Assert that DndContext wraps the full layout, not conditionally scoped to PlannerSidebar only.
 * EXPECTED TO FAIL on unfixed code because DndContext only wraps PlannerSidebar.
 */
describe('AppLayout bug condition', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../components/AppLayout.tsx'),
    'utf-8'
  );

  it('1b: DndContext wraps full layout and is not inside isPlannerOpen conditional', () => {
    // DndContext should NOT be conditionally rendered inside an isPlannerOpen block.
    // The unfixed code has: {isPlannerOpen ? (<DndContext ...>) : null}
    // which means DndContext is scoped only when planner is open and only wraps PlannerSidebar.
    expect(source).not.toMatch(/isPlannerOpen\s*\?\s*\(\s*<DndContext/);

    // DndContext should wrap more than just PlannerSidebar — it should wrap
    // MapView, BottomNav, MagicBar, etc. Check that DndContext contains MapView.
    const dndContextStart = source.indexOf('<DndContext');
    const dndContextEnd = source.indexOf('</DndContext>');
    expect(dndContextStart).toBeGreaterThan(-1);
    expect(dndContextEnd).toBeGreaterThan(dndContextStart);

    const dndContextBlock = source.slice(dndContextStart, dndContextEnd);
    expect(dndContextBlock).toContain('MapView');
  });
});
