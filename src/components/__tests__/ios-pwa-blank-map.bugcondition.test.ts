import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * Bug Condition Exploration Tests — iOS PWA Blank Map
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 *
 * These tests encode the EXPECTED (fixed) behavior. They are designed to FAIL
 * on unfixed code, confirming the bug exists. After the fix is applied, they
 * should PASS, confirming the bug is resolved.
 */

const mapViewSource = fs.readFileSync(
  path.resolve(__dirname, '../../components/MapView.tsx'),
  'utf-8'
);

const appLayoutSource = fs.readFileSync(
  path.resolve(__dirname, '../../components/AppLayout.tsx'),
  'utf-8'
);

const globalsCssSource = fs.readFileSync(
  path.resolve(__dirname, '../../app/globals.css'),
  'utf-8'
);

describe('iOS PWA Blank Map — Bug Condition Exploration', () => {
  /**
   * Test 1a — Tile Provider
   * Bug Condition: tileProvider == 'stadiamaps'
   * Expected: TILE_STYLE points to CARTO Positron, not Stadia Maps
   */
  it('1a: TILE_STYLE equals CARTO Positron URL (not Stadia Maps)', () => {
    const cartoUrl = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    // Extract the TILE_STYLE value from source
    const tileStyleMatch = mapViewSource.match(/const\s+TILE_STYLE\s*=\s*['"`]([^'"`]+)['"`]/);
    expect(tileStyleMatch).not.toBeNull();
    expect(tileStyleMatch![1]).toBe(cartoUrl);
  });

  /**
   * Test 1b — Post-Init Resize
   * Bug Condition: canvasWidth == 0 AND canvasHeight == 0
   * Expected: map init useEffect contains setTimeout with map.resize() after mapRef.current = map
   */
  it('1b: map init useEffect contains setTimeout with map.resize() after mapRef.current = map', () => {
    // Find the map init useEffect block (the one that creates new maplibregl.Map)
    const mapInitIndex = mapViewSource.indexOf('new maplibregl.Map(');
    expect(mapInitIndex).toBeGreaterThan(-1);

    // Get the code after map creation to check for the resize setTimeout
    const afterMapInit = mapViewSource.slice(mapInitIndex);

    // There should be a mapRef.current = map assignment followed by a setTimeout with map.resize()
    const mapRefAssignIndex = afterMapInit.indexOf('mapRef.current = map');
    expect(mapRefAssignIndex).toBeGreaterThan(-1);

    const afterAssign = afterMapInit.slice(mapRefAssignIndex);
    // Check for setTimeout call with map.resize()
    expect(afterAssign).toMatch(/setTimeout\s*\(\s*\(\)\s*=>\s*map\.resize\(\)/);
  });

  /**
   * Test 1c — AppLayout Height Fallback
   * Bug Condition: NOT cssSupports('100dvh')
   * Expected: root div className includes both h-screen and h-[100dvh]
   */
  it('1c: AppLayout root div className includes both h-screen and h-[100dvh]', () => {
    // The root div should have h-screen as a fallback before h-[100dvh]
    expect(appLayoutSource).toContain('h-screen');
    // Also must still have h-[100dvh]
    expect(appLayoutSource).toContain('h-[100dvh]');

    // Verify both appear in the same className string on the root div
    const rootDivMatch = appLayoutSource.match(/<div\s+className="([^"]+)">/);
    expect(rootDivMatch).not.toBeNull();
    const rootClassName = rootDivMatch![1];
    expect(rootClassName).toContain('h-screen');
    expect(rootClassName).toContain('h-[100dvh]');
  });

  /**
   * Test 1d — Body CSS Fallback
   * Bug Condition: NOT cssSupports('100dvh')
   * Expected: body rule contains height: 100% before height: 100dvh
   */
  it('1d: globals.css body rule contains height: 100% before height: 100dvh', () => {
    // Extract the body rule block
    const bodyRuleMatch = globalsCssSource.match(/body\s*\{([^}]+)\}/);
    expect(bodyRuleMatch).not.toBeNull();
    const bodyRule = bodyRuleMatch![1];

    // Must contain height: 100% as a fallback
    expect(bodyRule).toContain('height: 100%');
    // Must still contain height: 100dvh
    expect(bodyRule).toContain('height: 100dvh');

    // height: 100% must appear BEFORE height: 100dvh
    const fallbackIndex = bodyRule.indexOf('height: 100%');
    const dvhIndex = bodyRule.indexOf('height: 100dvh');
    expect(fallbackIndex).toBeLessThan(dvhIndex);
  });

  /**
   * PBT Property — Bug Condition
   * For all generated platform/OS combinations where isBugCondition returns true,
   * assert the source code contains the expected fix patterns.
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   */
  it('PBT: for all iOS bug condition inputs, source contains expected fix patterns', () => {
    // Model the bug condition inputs
    const iosBugConditionArb = fc.record({
      platform: fc.constant('iOS' as const),
      osVersion: fc.integer({ min: 13, max: 17 }),
      isPWA: fc.boolean(),
    });

    fc.assert(
      fc.property(iosBugConditionArb, (input) => {
        const tileBlocked = input.isPWA && input.platform === 'iOS';
        const canvasZero = input.platform === 'iOS';
        const dvhMissing = input.platform === 'iOS' && input.osVersion < 16;

        const isBugCondition = tileBlocked || canvasZero || dvhMissing;

        if (isBugCondition) {
          // Tile provider must be CARTO
          const tileMatch = mapViewSource.match(/const\s+TILE_STYLE\s*=\s*['"`]([^'"`]+)['"`]/);
          expect(tileMatch).not.toBeNull();
          expect(tileMatch![1]).toBe(
            'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
          );

          // Post-init resize must exist
          const afterMapInit = mapViewSource.slice(mapViewSource.indexOf('mapRef.current = map'));
          expect(afterMapInit).toMatch(/setTimeout\s*\(\s*\(\)\s*=>\s*map\.resize\(\)/);

          // h-screen fallback must exist
          expect(appLayoutSource).toContain('h-screen');

          // height: 100% fallback must exist in body
          const bodyMatch = globalsCssSource.match(/body\s*\{([^}]+)\}/);
          expect(bodyMatch).not.toBeNull();
          expect(bodyMatch![1]).toContain('height: 100%');
        }
      }),
      { numRuns: 50 }
    );
  });
});
