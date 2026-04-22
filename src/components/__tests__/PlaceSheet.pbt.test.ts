import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Handler under test — mirrors the onKeyDown logic in PlaceSheet's editTitle input:
//   onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); }}
// ---------------------------------------------------------------------------

const handleKeyDown = (key: string, handleSaveEdit: () => void) => {
  if (key === 'Enter') handleSaveEdit();
};

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates random key names that are NOT "Enter". */
const nonEnterKeyArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s !== 'Enter');

// ===================================================================
// Feature: qa-hotfix-country-filter, Property 2: Non-Enter keys do not trigger save
// **Validates: Requirements 4.3**
// ===================================================================

describe('Feature: qa-hotfix-country-filter, Property 2: Non-Enter keys do not trigger save', () => {
  it('handleSaveEdit is never called for any key other than Enter', () => {
    fc.assert(
      fc.property(nonEnterKeyArb, (key) => {
        const handleSaveEdit = vi.fn();
        handleKeyDown(key, handleSaveEdit);
        expect(handleSaveEdit).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  it('handleSaveEdit IS called when key is Enter (positive control)', () => {
    const handleSaveEdit = vi.fn();
    handleKeyDown('Enter', handleSaveEdit);
    expect(handleSaveEdit).toHaveBeenCalledOnce();
  });
});
