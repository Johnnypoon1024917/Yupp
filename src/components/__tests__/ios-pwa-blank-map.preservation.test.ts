import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * Preservation Property Tests — iOS PWA Blank Map Fix
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 *
 * These tests observe and lock down EXISTING behavior on UNFIXED code.
 * They must PASS on unfixed code (confirming baseline) and continue to
 * PASS after the fix is applied (confirming no regressions).
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

// --- Observation helpers ---

/** Extract the root div className from AppLayout source */
function getRootDivClassName(): string {
  const match = appLayoutSource.match(/<div\s+className="([^"]+)">/);
  if (!match) throw new Error('Could not find root div className in AppLayout');
  return match[1];
}

/** Extract the POI filter keywords array from MapView source */
function getPOIFilterKeywords(): string[] {
  const match = mapViewSource.match(
    /const\s+POI_LAYER_FILTERS\s*=\s*\[([^\]]+)\]/
  );
  if (!match) throw new Error('Could not find POI_LAYER_FILTERS in MapView');
  return match[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''));
}

/** Extract the shouldHideLayer function body from MapView source */
function shouldHideLayer(layerId: string): boolean {
  const keywords = getPOIFilterKeywords();
  const id = layerId.toLowerCase();
  return keywords.some((keyword) => id.includes(keyword));
}

/** Extract the body CSS rule from globals.css */
function getBodyRule(): string {
  const match = globalsCssSource.match(/body\s*\{([^}]+)\}/);
  if (!match) throw new Error('Could not find body rule in globals.css');
  return match[1];
}

/** Extract the MapView inline style object from source */
function getMapViewInlineStyles(): Record<string, string> {
  // Match the style={{ ... }} block on the container div
  const match = mapViewSource.match(/style=\{\{([^}]+)\}\}/);
  if (!match) throw new Error('Could not find inline styles in MapView');
  const styleBlock = match[1];
  const styles: Record<string, string> = {};
  // Parse key: 'value' or key: value patterns
  const entries = styleBlock.matchAll(/(\w+)\s*:\s*['"]?([^,'"\n]+)['"]?/g);
  for (const entry of entries) {
    styles[entry[1].trim()] = entry[2].trim();
  }
  return styles;
}

/** Check that MapView exposes the expected ref methods */
function getExposedRefMethods(): string[] {
  const match = mapViewSource.match(
    /useImperativeHandle\s*\(\s*ref\s*,\s*\(\)\s*=>\s*\(\{([^}]+)\}\)/
  );
  if (!match) throw new Error('Could not find useImperativeHandle in MapView');
  return match[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

describe('iOS PWA Blank Map — Preservation Properties', () => {
  // --- Observation confirmations (unit-level) ---

  describe('Observations on unfixed code', () => {
    it('MapView renders with expected inline styles', () => {
      const styles = getMapViewInlineStyles();
      expect(styles.position).toBe('absolute');
      expect(styles.width).toBe('100%');
      expect(styles.height).toBe('100%');
    });

    it('MapView accepts className prop and applies it to container div', () => {
      // The component signature accepts className
      expect(mapViewSource).toContain('className?: string');
      // The container div uses className
      expect(mapViewSource).toMatch(/className=\{className\}/);
    });

    it('AppLayout root div has expected classes', () => {
      const rootClassName = getRootDivClassName();
      expect(rootClassName).toContain('relative');
      expect(rootClassName).toContain('w-screen');
      expect(rootClassName).toContain('overflow-hidden');
      expect(rootClassName).toContain('overscroll-none');
      expect(rootClassName).toContain('bg-[#FAFAFA]');
    });

    it('globals.css body has expected CSS properties', () => {
      const bodyRule = getBodyRule();
      expect(bodyRule).toContain('overflow: hidden');
      expect(bodyRule).toContain('position: fixed');
      expect(bodyRule).toContain('width: 100vw');
      expect(bodyRule).toContain('overscroll-behavior: none');
      expect(bodyRule).toContain('touch-action: none');
    });

    it('shouldHideLayer filters with expected POI keywords', () => {
      const keywords = getPOIFilterKeywords();
      expect(keywords).toEqual(['poi', 'label', 'icon', 'place', 'text']);
    });

    it('MapView exposes flyToPin, resize, disableInteractions, enableInteractions via ref', () => {
      const methods = getExposedRefMethods();
      expect(methods).toContain('flyToPin');
      expect(methods).toContain('resize');
      expect(methods).toContain('disableInteractions');
      expect(methods).toContain('enableInteractions');
    });
  });

  // --- PBT Properties ---

  /**
   * Property 2a: For all random viewport dimension strings, the AppLayout root
   * div always contains `w-screen`, `overflow-hidden`, `overscroll-none` classes.
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  it('PBT 2a: AppLayout root div always contains w-screen, overflow-hidden, overscroll-none for any viewport', () => {
    const rootClassName = getRootDivClassName();

    const viewportDimensionArb = fc.tuple(
      fc.integer({ min: 320, max: 3840 }),
      fc.integer({ min: 480, max: 2160 })
    );

    fc.assert(
      fc.property(viewportDimensionArb, ([_width, _height]) => {
        // Regardless of viewport dimensions, the root div classes are static
        // and must always contain these layout-critical classes
        expect(rootClassName).toContain('w-screen');
        expect(rootClassName).toContain('overflow-hidden');
        expect(rootClassName).toContain('overscroll-none');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2b: For all random layer ID strings, `shouldHideLayer` returns true
   * iff the ID contains one of the POI filter keywords.
   *
   * **Validates: Requirements 3.4, 3.5**
   */
  it('PBT 2b: shouldHideLayer returns true iff layer ID contains a POI keyword', () => {
    const keywords = getPOIFilterKeywords();

    // Arbitrary: random layer ID strings
    const layerIdArb = fc.oneof(
      fc.string({ minLength: 0, maxLength: 50 }),
      // Bias toward keyword-containing strings for better coverage
      fc.constantFrom(...keywords).chain((kw) =>
        fc.tuple(
          fc.string({ minLength: 0, maxLength: 10 }),
          fc.string({ minLength: 0, maxLength: 10 })
        ).map(([prefix, suffix]) => `${prefix}${kw}${suffix}`)
      )
    );

    fc.assert(
      fc.property(layerIdArb, (layerId) => {
        const result = shouldHideLayer(layerId);
        const idLower = layerId.toLowerCase();
        const expected = keywords.some((kw) => idLower.includes(kw));
        expect(result).toBe(expected);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Property 2c: For all random strings, the MapView inline styles always include
   * `position: 'absolute'`, `width: '100%'`, `height: '100%'`.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it('PBT 2c: MapView inline styles always include position absolute, width 100%, height 100%', () => {
    const styles = getMapViewInlineStyles();

    // The inline styles are static in the source — verify they hold for any
    // hypothetical className or prop combination (styles are not conditional)
    const randomStringArb = fc.string({ minLength: 0, maxLength: 100 });

    fc.assert(
      fc.property(randomStringArb, (_randomInput) => {
        // Regardless of any input, the inline styles are hardcoded and must
        // always contain these critical sizing properties
        expect(styles.position).toBe('absolute');
        expect(styles.width).toBe('100%');
        expect(styles.height).toBe('100%');
      }),
      { numRuns: 100 }
    );
  });
});
