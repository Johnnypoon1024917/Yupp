// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import type { PlannedPin } from '@/types';
import type { DistanceSegment } from '@/hooks/useDistanceMatrix';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

const mockUseDistanceMatrix = vi.fn();
vi.mock('@/hooks/useDistanceMatrix', () => ({
  useDistanceMatrix: (...args: any[]) => mockUseDistanceMatrix(...args),
}));

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => children,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: 'vertical',
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef((props: any, ref: any) =>
      React.createElement('div', { ...props, ref }),
    ),
  },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('lucide-react', () => ({
  GripVertical: (props: any) => React.createElement('span', props),
  Map: (props: any) => React.createElement('span', props),
  MapPin: (props: any) => React.createElement('span', props),
}));

vi.mock('@/utils/mapExport', () => ({
  getGoogleMapsDirUrl: () => '#',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePin(index: number): PlannedPin {
  return {
    id: `pin-${index}`,
    title: `Place ${index}`,
    imageUrl: '',
    sourceUrl: '',
    latitude: 35 + index * 0.01,
    longitude: 139 + index * 0.01,
    collectionId: 'col-1',
    createdAt: '2024-01-01T00:00:00Z',
    day_number: 1,
    sort_order: index,
    itinerary_item_id: `item-${index}`,
  };
}

function makePins(count: number): PlannedPin[] {
  return Array.from({ length: count }, (_, i) => makePin(i));
}

function makeSegment(index: number): DistanceSegment {
  return {
    distance: `dist${index}`,
    duration: `dur${index}`,
    mode: 'driving',
  };
}

async function renderDayContainer(pins: PlannedPin[]): Promise<string> {
  const { default: DayContainer } = await import('../DayContainer');
  const element = React.createElement(DayContainer, { dayNumber: 1, pins });
  return ReactDOMServer.renderToString(element);
}

async function renderBridge(props: {
  distance?: DistanceSegment;
  isLoading?: boolean;
}): Promise<string> {
  const { default: BridgeElement } = await import('../BridgeElement');
  const element = React.createElement(BridgeElement, props);
  return ReactDOMServer.renderToString(element);
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Pin count between 2 and 20 */
const pinCountArb = fc.integer({ min: 2, max: 20 });

/** Alphanumeric string safe for renderToString (no HTML encoding issues) */
const safeStringArb = fc.stringMatching(/^[a-zA-Z0-9 ]{1,30}$/).filter(
  (s) => s.trim().length > 0,
);

/** Travel mode arbitrary */
const modeArb = fc.constantFrom<'driving' | 'transit'>('driving', 'transit');


// ===================================================================
// Feature: distance-matrix-display, Property 1: Bridge count invariant
// **Validates: Requirements 6.1**
// ===================================================================

describe('Feature: distance-matrix-display, Property 1: Bridge count invariant', () => {
  it('for any N pins (2–20), DayContainer renders exactly N−1 BridgeElements', async () => {
    // Pre-load the module once outside the property loop
    const { default: DayContainer } = await import('../DayContainer');

    fc.assert(
      fc.property(pinCountArb, (n) => {
        const pins = makePins(n);

        mockUseDistanceMatrix.mockReturnValue({
          segments: [],
          isLoading: false,
          error: null,
        });

        const element = React.createElement(DayContainer, { dayNumber: 1, pins });
        const html = ReactDOMServer.renderToString(element);

        // Each BridgeElement renders a wrapper div with class "py-2".
        // TimelineCards do not use py-2, so counting py-2 gives bridge count.
        const bridgeMatches = html.match(/py-2/g);
        const bridgeCount = bridgeMatches ? bridgeMatches.length : 0;

        expect(bridgeCount).toBe(n - 1);
      }),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Feature: distance-matrix-display, Property 2: Segment-to-bridge alignment
// **Validates: Requirements 1.3, 6.2, 6.3**
// ===================================================================

describe('Feature: distance-matrix-display, Property 2: Segment-to-bridge alignment', () => {
  it('bridge i gets segments[i] when i < M, and undefined (fallback) when i >= M', async () => {
    const { default: DayContainer } = await import('../DayContainer');

    fc.assert(
      fc.property(
        pinCountArb.chain((n) =>
          fc.tuple(fc.constant(n), fc.integer({ min: 0, max: n - 1 })),
        ),
        ([n, m]) => {
          const pins = makePins(n);
          const segments = Array.from({ length: m }, (_, i) => makeSegment(i));

          mockUseDistanceMatrix.mockReturnValue({
            segments,
            isLoading: false,
            error: null,
          });

          const element = React.createElement(DayContainer, { dayNumber: 1, pins });
          const html = ReactDOMServer.renderToString(element);

          // Bridges with data (0..M-1) should contain their unique distance string
          for (let i = 0; i < m; i++) {
            expect(html).toContain(`dist${i}`);
            expect(html).toContain(`dur${i}`);
          }

          // Bridges without data (M..N-2) should NOT contain those distance strings
          for (let i = m; i < n - 1; i++) {
            expect(html).not.toContain(`dist${i}`);
            expect(html).not.toContain(`dur${i}`);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Feature: distance-matrix-display, Property 3: BridgeElement displays segment data faithfully
// **Validates: Requirements 4.3, 4.4**
// ===================================================================

describe('Feature: distance-matrix-display, Property 3: BridgeElement displays segment data faithfully', () => {
  it('rendered BridgeElement output contains both the distance and duration strings', async () => {
    const { default: BridgeElement } = await import('../BridgeElement');

    fc.assert(
      fc.property(safeStringArb, safeStringArb, modeArb, (distance, duration, mode) => {
        const segment: DistanceSegment = { distance, duration, mode };

        const element = React.createElement(BridgeElement, {
          distance: segment,
          isLoading: false,
        });
        const html = ReactDOMServer.renderToString(element);

        expect(html).toContain(distance);
        expect(html).toContain(duration);
      }),
      { numRuns: 100 },
    );
  });
});
