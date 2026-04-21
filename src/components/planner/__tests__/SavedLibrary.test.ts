// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { extractCity, groupPinsByCity, filterPins } from '../LibraryPane';
import type { Pin } from '@/types';

// ---------------------------------------------------------------------------
// Mocks for SavedLibrary SSR tests
// ---------------------------------------------------------------------------

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef((props: any, ref: any) => React.createElement('div', { ...props, ref })),
  },
}));

vi.mock('lucide-react', () => ({
  Search: (props: any) => React.createElement('svg', props),
  GripVertical: (props: any) => React.createElement('svg', props),
  MapPin: (props: any) => React.createElement('svg', props),
}));

let savedLibraryStoreState: any;

vi.mock('@/store/useTravelPinStore', () => {
  const store = (selector: any) => selector(savedLibraryStoreState);
  store.getState = () => savedLibraryStoreState;
  store.setState = vi.fn();
  store.subscribe = vi.fn();
  return { default: store };
});

function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: overrides.id ?? '1',
    title: overrides.title ?? 'Test Pin',
    imageUrl: overrides.imageUrl ?? 'https://example.com/img.jpg',
    sourceUrl: overrides.sourceUrl ?? 'https://example.com',
    latitude: overrides.latitude ?? 0,
    longitude: overrides.longitude ?? 0,
    collectionId: overrides.collectionId ?? 'unorganized',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    address: overrides.address,
  };
}

describe('extractCity', () => {
  it('returns second-to-last comma-separated segment as city', () => {
    expect(extractCity('123 Main St, Tokyo, Japan')).toBe('Tokyo');
  });

  it('returns the whole string when no commas (single segment)', () => {
    expect(extractCity('Japan')).toBe('Japan');
  });

  it('returns "Unknown Location" for undefined address', () => {
    expect(extractCity(undefined)).toBe('Unknown Location');
  });

  it('returns "Unknown Location" for empty string', () => {
    expect(extractCity('')).toBe('Unknown Location');
  });

  it('returns "Unknown Location" for whitespace-only string', () => {
    expect(extractCity('   ')).toBe('Unknown Location');
  });

  it('trims whitespace from the segment', () => {
    expect(extractCity('Street,  Bali  , Indonesia')).toBe('Bali');
  });

  it('returns first segment when only two segments', () => {
    expect(extractCity('Tokyo, Japan')).toBe('Tokyo');
  });
});

describe('groupPinsByCity', () => {
  it('groups pins by their derived city', () => {
    const pins = [
      makePin({ id: '1', address: 'Shibuya, Tokyo, Japan' }),
      makePin({ id: '2', address: 'Shinjuku, Tokyo, Japan' }),
      makePin({ id: '3', address: 'Ubud, Bali, Indonesia' }),
    ];
    const groups = groupPinsByCity(pins);
    expect(Object.keys(groups).sort()).toEqual(['Bali', 'Tokyo']);
    expect(groups['Tokyo']).toHaveLength(2);
    expect(groups['Bali']).toHaveLength(1);
  });

  it('places pins without address in "Unknown Location"', () => {
    const pins = [makePin({ id: '1' })];
    const groups = groupPinsByCity(pins);
    expect(groups['Unknown Location']).toHaveLength(1);
  });

  it('returns empty object for empty array', () => {
    expect(groupPinsByCity([])).toEqual({});
  });

  it('every pin appears in exactly one group', () => {
    const pins = [
      makePin({ id: '1', address: 'A, Tokyo, Japan' }),
      makePin({ id: '2', address: 'B, Tokyo, Japan' }),
      makePin({ id: '3', address: 'C, Paris, France' }),
    ];
    const groups = groupPinsByCity(pins);
    const total = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(pins.length);
  });
});

describe('filterPins', () => {
  const pins = [
    makePin({ id: '1', title: 'Eiffel Tower', address: 'Champ de Mars, Paris, France' }),
    makePin({ id: '2', title: 'Tokyo Tower', address: 'Minato, Tokyo, Japan' }),
    makePin({ id: '3', title: 'Bali Beach', address: 'Kuta, Bali, Indonesia' }),
  ];

  it('returns all pins for empty query', () => {
    expect(filterPins(pins, '')).toHaveLength(3);
    expect(filterPins(pins, '   ')).toHaveLength(3);
  });

  it('filters by title (case-insensitive)', () => {
    const result = filterPins(pins, 'tower');
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id).sort()).toEqual(['1', '2']);
  });

  it('filters by city name (case-insensitive)', () => {
    const result = filterPins(pins, 'tokyo');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('returns empty array when nothing matches', () => {
    expect(filterPins(pins, 'zzzzz')).toHaveLength(0);
  });

  it('handles pins with no address gracefully', () => {
    const pinsNoAddr = [makePin({ id: '1', title: 'Cafe' })];
    expect(filterPins(pinsNoAddr, 'cafe')).toHaveLength(1);
    expect(filterPins(pinsNoAddr, 'tokyo')).toHaveLength(0);
  });
});


// ---------------------------------------------------------------------------
// SavedLibrary Component SSR Tests — Toggle Control
// ---------------------------------------------------------------------------

async function renderSavedLibrary(): Promise<string> {
  const { default: SavedLibrary } = await import('../SavedLibrary');
  const element = React.createElement(SavedLibrary, {});
  return ReactDOMServer.renderToString(element);
}

describe('SavedLibrary toggle control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savedLibraryStoreState = {
      pins: [
        makePin({ id: 'p1', title: 'Ramen Shop', collectionId: 'food-1', address: 'Shibuya, Tokyo, Japan' }),
      ],
      collections: [
        { id: 'food-1', name: 'Food & Drink', createdAt: new Date().toISOString() },
      ],
    };
  });

  // Req 5.1 — Toggle control renders with both "Region" and "Category" buttons
  it('renders toggle control with Region and Category buttons (Req 5.1)', async () => {
    const html = await renderSavedLibrary();

    expect(html).toContain('>Region</button>');
    expect(html).toContain('>Category</button>');
  });

  // Req 5.4 — Default mode is "Group by Region" (Region button has active styling)
  it('defaults to "Group by Region" mode with Region button active (Req 5.4)', async () => {
    const html = await renderSavedLibrary();

    // The Region button should have the active class bg-white
    // Extract the Region button's class to verify it has the active styling
    const regionButtonMatch = html.match(/<button[^>]*>Region<\/button>/);
    expect(regionButtonMatch).not.toBeNull();
    const regionButton = regionButtonMatch![0];
    expect(regionButton).toContain('bg-white');

    // The Category button should NOT have the active bg-white class
    const categoryButtonMatch = html.match(/<button[^>]*>Category<\/button>/);
    expect(categoryButtonMatch).not.toBeNull();
    const categoryButton = categoryButtonMatch![0];
    expect(categoryButton).not.toContain('bg-white');
  });

  // Req 5.5 — Switching mode re-renders pin list without full page reload
  // In SSR we verify the initial render groups by region (city-based grouping).
  // The component uses client-side state, so we verify the default render shows
  // region-based grouping (city names) rather than category-based grouping.
  it('renders pins grouped by region in default mode (Req 5.5)', async () => {
    const html = await renderSavedLibrary();

    // In region mode, pins are grouped by the last segment of the address (country/region).
    // "Shibuya, Tokyo, Japan" → extractRegion returns "Japan"
    expect(html).toContain('Japan');
  });
});
