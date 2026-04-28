// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import type { Pin } from '@/types';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

// Mock vaul Drawer to render children directly
vi.mock('vaul', () => {
  const Root = ({ children, open }: any) => (open ? children : null);
  const Portal = ({ children }: any) => children;
  const Overlay = (props: any) => React.createElement('div', props);
  const Content = ({ children, ...props }: any) => React.createElement('div', props, children);
  const Title = ({ children, ...props }: any) => React.createElement('span', props, children);
  return {
    Drawer: { Root, Portal, Overlay, Content, Title },
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Share2: (props: any) => React.createElement('svg', props),
  FolderOpen: (props: any) => React.createElement('svg', props),
  Check: (props: any) => React.createElement('svg', props),
  Plus: (props: any) => React.createElement('svg', props),
  Pencil: (props: any) => React.createElement('svg', props),
  Utensils: (props: any) => React.createElement('svg', { ...props, 'data-icon': 'utensils' }),
  Bed: (props: any) => React.createElement('svg', { ...props, 'data-icon': 'bed' }),
  Camera: (props: any) => React.createElement('svg', { ...props, 'data-icon': 'camera' }),
  ShoppingBag: (props: any) => React.createElement('svg', { ...props, 'data-icon': 'shopping-bag' }),
  MapPin: (props: any) => React.createElement('svg', { ...props, 'data-icon': 'map-pin' }),
}));

// Mock trackReferralClick server action
const mockTrackReferralClick = vi.fn().mockResolvedValue({ success: true });
vi.mock('@/actions/trackReferralClick', () => ({
  trackReferralClick: (...args: any[]) => mockTrackReferralClick(...args),
}));

// Store state — mutable so individual tests can override collections
let storeState: any;

vi.mock('@/store/useTravelPinStore', () => {
  const store = (selector: any) => selector(storeState);
  store.getState = () => storeState;
  store.setState = vi.fn();
  store.subscribe = vi.fn();
  return { default: store };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'test-pin-id',
    title: 'Test Place',
    imageUrl: 'https://example.com/img.jpg',
    sourceUrl: 'https://example.com',
    latitude: 0,
    longitude: 0,
    collectionId: 'unorganized',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

async function renderPlaceSheet(pin: Pin | null): Promise<string> {
  const { default: PlaceSheet } = await import('@/components/PlaceSheet');
  const element = React.createElement(PlaceSheet, { pin, onDismiss: vi.fn() });
  return ReactDOMServer.renderToString(element);
}

// ---------------------------------------------------------------------------
// Tests — Smart Pin Organizer: PlaceSheet UI
// ---------------------------------------------------------------------------

describe('PlaceSheet category pill and image fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState = {
      removePin: vi.fn(),
      movePin: vi.fn(),
      addCollection: vi.fn(),
      updatePin: vi.fn(),
      collections: [
        { id: 'unorganized', name: 'Unorganized', createdAt: new Date().toISOString() },
      ],
      setActivePinId: vi.fn(),
    };
  });

  // Req 3.1 — Category pill renders with correct collection name
  it('renders category pill with the correct collection name (Req 3.1)', async () => {
    const foodCollectionId = 'food-drink-collection';
    storeState.collections.push({
      id: foodCollectionId,
      name: 'Food & Drink',
      createdAt: new Date().toISOString(),
    });

    const pin = makePin({ collectionId: foodCollectionId, primaryType: 'restaurant' });
    const html = await renderPlaceSheet(pin);

    expect(html).toContain('Food &amp; Drink');
  });

  // Req 3.2 — Pill shows "Unorganized" for default collection
  it('shows "Unorganized" in the pill for the default collection (Req 3.2)', async () => {
    const pin = makePin({ collectionId: 'unorganized' });
    const html = await renderPlaceSheet(pin);

    expect(html).toContain('Unorganized');
  });

  // Req 3.3 — Pill has distinct styling classes
  it('renders the category pill with distinct styling classes (Req 3.3)', async () => {
    const pin = makePin({ collectionId: 'unorganized' });
    const html = await renderPlaceSheet(pin);

    expect(html).toContain('rounded-full');
    expect(html).toContain('px-3');
    expect(html).toContain('py-1');
    expect(html).toContain('bg-surface-sunken');
  });

  // Req 4.1 — Image renders when imageUrl is present
  it('renders an <img> tag when imageUrl is present (Req 4.1)', async () => {
    const pin = makePin({ imageUrl: 'https://example.com/photo.jpg' });
    const html = await renderPlaceSheet(pin);

    expect(html).toContain('<img');
    expect(html).toContain('https://example.com/photo.jpg');
  });

  // Req 4.2 — Gradient fallback renders when imageUrl is missing
  it('renders gradient fallback when imageUrl is missing (Req 4.2)', async () => {
    const pin = makePin({ imageUrl: '' });
    const html = await renderPlaceSheet(pin);

    // Should NOT contain an <img> tag
    expect(html).not.toContain('<img');
    // Should contain a gradient class from getCategoryGradient
    expect(html).toContain('bg-gradient-to-br');
  });

  // Req 4.3 — Category icon renders on gradient
  it('renders a category icon (SVG) on the gradient fallback (Req 4.3)', async () => {
    const pin = makePin({ imageUrl: '' });
    const html = await renderPlaceSheet(pin);

    // The gradient fallback should contain an SVG element (the Lucide icon)
    expect(html).toContain('<svg');
  });
});
