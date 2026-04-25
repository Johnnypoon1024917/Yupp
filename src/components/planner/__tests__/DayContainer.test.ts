// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import type { PlannedPin } from '@/types';

// ---------------------------------------------------------------------------
// Mocks
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

function makePin(overrides: Partial<PlannedPin> = {}): PlannedPin {
  return {
    id: 'pin-1',
    title: 'Place A',
    imageUrl: '',
    sourceUrl: '',
    latitude: 35.6762,
    longitude: 139.6503,
    collectionId: 'col-1',
    createdAt: '2024-01-01T00:00:00Z',
    day_number: 1,
    sort_order: 0,
    itinerary_item_id: 'item-1',
    ...overrides,
  };
}

async function renderDayContainer(props: {
  dayNumber: number;
  pins: PlannedPin[];
  isLoading?: boolean;
}): Promise<string> {
  const { default: DayContainer } = await import('../DayContainer');
  const element = React.createElement(DayContainer, props);
  return ReactDOMServer.renderToString(element);
}

// ---------------------------------------------------------------------------
// DayContainer Integration Unit Tests
// ---------------------------------------------------------------------------

describe('DayContainer distance matrix integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDistanceMatrix.mockReturnValue({
      segments: [],
      isLoading: false,
      error: null,
    });
  });

  // Req 1.1 — Hook called with correct args for ≥2 pins
  it('calls useDistanceMatrix with pins array and driving mode when ≥2 pins', async () => {
    const pins = [
      makePin({ id: 'pin-1', itinerary_item_id: 'item-1', sort_order: 0 }),
      makePin({ id: 'pin-2', itinerary_item_id: 'item-2', sort_order: 1, title: 'Place B' }),
    ];

    mockUseDistanceMatrix.mockReturnValue({
      segments: [{ distance: '5 km', duration: '10 mins', mode: 'driving' as const }],
      isLoading: false,
      error: null,
    });

    await renderDayContainer({ dayNumber: 1, pins });

    expect(mockUseDistanceMatrix).toHaveBeenCalledWith(pins, 'driving');
  });

  // Req 1.2 — No fetch for <2 pins (hook still called, but handles it internally)
  it('calls useDistanceMatrix even with 0 or 1 pin (hook handles <2 internally)', async () => {
    const singlePin = [makePin()];

    await renderDayContainer({ dayNumber: 1, pins: singlePin });

    // Hook is still called — it internally returns empty segments for <2 pins
    expect(mockUseDistanceMatrix).toHaveBeenCalledWith(singlePin, 'driving');

    // No BridgeElements should be rendered (only 1 pin, no pairs)
    const html = await renderDayContainer({ dayNumber: 1, pins: singlePin });
    expect(html).not.toContain('animate-pulse');
    expect(html).not.toContain('border-dashed');
  });

  // Req 1.4 — isLoading forwarded to all bridges
  it('forwards isLoading to all BridgeElements showing skeleton state', async () => {
    const pins = [
      makePin({ id: 'pin-1', itinerary_item_id: 'item-1', sort_order: 0 }),
      makePin({ id: 'pin-2', itinerary_item_id: 'item-2', sort_order: 1, title: 'Place B' }),
      makePin({ id: 'pin-3', itinerary_item_id: 'item-3', sort_order: 2, title: 'Place C' }),
    ];

    mockUseDistanceMatrix.mockReturnValue({
      segments: [],
      isLoading: true,
      error: null,
    });

    const html = await renderDayContainer({ dayNumber: 1, pins });

    // With 3 pins there should be 2 BridgeElements, both showing loading skeleton
    // Count occurrences of animate-pulse (each bridge renders one animate-pulse div)
    const pulseMatches = html.match(/animate-pulse/g);
    expect(pulseMatches).not.toBeNull();
    expect(pulseMatches!.length).toBeGreaterThanOrEqual(2);
  });
});
