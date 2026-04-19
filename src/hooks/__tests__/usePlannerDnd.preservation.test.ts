import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseDayFromTarget } from '@/hooks/usePlannerDnd';
import type { PlannedPin } from '@/types';

/**
 * Preservation Property Tests for parseDayFromTarget
 * Validates: Requirements 3.1, 3.2, 3.3
 *
 * These tests capture the baseline behavior of parseDayFromTarget on UNFIXED code.
 * They must PASS before the fix and continue to PASS after the fix.
 */

function makePlannedPin(overrides: Partial<PlannedPin> = {}): PlannedPin {
  return {
    id: overrides.id ?? 'pin-1',
    itinerary_item_id: overrides.itinerary_item_id ?? 'item-1',
    pin_id: overrides.pin_id ?? 'pin-1',
    day_number: overrides.day_number ?? 1,
    sort_order: overrides.sort_order ?? 0,
    title: overrides.title ?? 'Test Pin',
    latitude: overrides.latitude ?? 0,
    longitude: overrides.longitude ?? 0,
    imageUrl: overrides.imageUrl ?? 'https://example.com/img.jpg',
    sourceUrl: overrides.sourceUrl ?? 'https://example.com',
    collectionId: overrides.collectionId ?? 'unorganized',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    address: overrides.address,
    position: overrides.position ?? 0,
    notes: overrides.notes,
  } as PlannedPin;
}

describe('parseDayFromTarget — preservation properties', () => {
  it('Property 1: for all valid day-N overId strings, returns N', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        (n) => {
          const result = parseDayFromTarget(`day-${n}`, undefined, {});
          expect(result).toBe(n);
        }
      )
    );
  });

  it('Property 2: for overId matching a pin itinerary_item_id in dayItems, returns the correct day number', () => {
    const plannedPinArb = fc.record({
      itinerary_item_id: fc.uuid(),
      id: fc.uuid(),
    });

    const dayItemsArb = fc
      .array(
        fc.tuple(
          fc.integer({ min: 1, max: 30 }),
          fc.array(plannedPinArb, { minLength: 1, maxLength: 5 })
        ),
        { minLength: 1, maxLength: 10 }
      )
      .map((entries) => {
        const dayItems: Record<number, PlannedPin[]> = {};
        for (const [dayNum, pins] of entries) {
          dayItems[dayNum] = pins.map((p) =>
            makePlannedPin({
              itinerary_item_id: p.itinerary_item_id,
              id: p.id,
              day_number: dayNum,
            })
          );
        }
        return dayItems;
      });

    fc.assert(
      fc.property(dayItemsArb, (dayItems) => {
        // Pick a random pin from the dayItems and verify parseDayFromTarget finds it
        for (const [dayStr, pins] of Object.entries(dayItems)) {
          const dayNum = Number(dayStr);
          for (const pin of pins) {
            const result = parseDayFromTarget(
              pin.itinerary_item_id,
              undefined,
              dayItems
            );
            expect(result).toBe(dayNum);
          }
        }
      })
    );
  });

  it('Property 3: for overId not matching any day pattern or pin ID, returns null', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          (s) => !s.startsWith('day-') && !s.includes('-')
        ),
        (overId) => {
          // Use empty dayItems so no pin ID can match
          const result = parseDayFromTarget(overId, undefined, {});
          expect(result).toBeNull();
        }
      )
    );
  });

  it('Property 4: when overData has type day-container and valid dayNumber, returns that day number', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (s) => !s.startsWith('day-')
        ),
        (dayNumber, overId) => {
          const overData = { type: 'day-container', dayNumber };
          const result = parseDayFromTarget(overId, overData, {});
          expect(result).toBe(dayNumber);
        }
      )
    );
  });
});
