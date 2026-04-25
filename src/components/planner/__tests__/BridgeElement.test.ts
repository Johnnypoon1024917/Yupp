// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import type { DistanceSegment } from '@/hooks/useDistanceMatrix';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function renderBridge(props: {
  distance?: DistanceSegment;
  isLoading?: boolean;
} = {}): Promise<string> {
  const { default: BridgeElement } = await import('../BridgeElement');
  const element = React.createElement(BridgeElement, props);
  return ReactDOMServer.renderToString(element);
}

// ---------------------------------------------------------------------------
// BridgeElement Unit Tests
// ---------------------------------------------------------------------------

describe('BridgeElement', () => {
  // Req 2.3, 5.1, 5.2 — Fallback dashed line when no props
  it('renders a dashed connector line with no text content when no props are provided', async () => {
    const html = await renderBridge();

    expect(html).toContain('border-dashed');
    // Should NOT contain any distance/duration text or mode icons
    expect(html).not.toContain('🚗');
    expect(html).not.toContain('🚶');
    expect(html).not.toContain('animate-pulse');
  });

  // Req 3.1 — Skeleton on isLoading=true
  it('renders a pulsing skeleton when isLoading is true', async () => {
    const html = await renderBridge({ isLoading: true });

    expect(html).toContain('animate-pulse');
  });

  // Req 3.2 — Stale data hidden during loading
  it('shows skeleton instead of stale distance data when both distance and isLoading are provided', async () => {
    const staleSegment: DistanceSegment = {
      distance: '5.2 km',
      duration: '12 mins',
      mode: 'driving',
    };
    const html = await renderBridge({ distance: staleSegment, isLoading: true });

    // Should show skeleton, NOT the stale data
    expect(html).toContain('animate-pulse');
    expect(html).not.toContain('5.2 km');
    expect(html).not.toContain('12 mins');
    expect(html).not.toContain('🚗');
  });

  // Req 4.1 — Driving icon
  it('renders 🚗 icon when distance mode is driving', async () => {
    const segment: DistanceSegment = {
      distance: '10 km',
      duration: '15 mins',
      mode: 'driving',
    };
    const html = await renderBridge({ distance: segment });

    expect(html).toContain('🚗');
  });

  // Req 4.2 — Transit icon
  it('renders 🚶 icon when distance mode is transit', async () => {
    const segment: DistanceSegment = {
      distance: '2 km',
      duration: '25 mins',
      mode: 'transit',
    };
    const html = await renderBridge({ distance: segment });

    expect(html).toContain('🚶');
  });

  // Req 4.3, 4.4 — Duration and distance text displayed
  it('displays both duration and distance strings when a segment is provided', async () => {
    const segment: DistanceSegment = {
      distance: '8.3 km',
      duration: '22 mins',
      mode: 'driving',
    };
    const html = await renderBridge({ distance: segment });

    expect(html).toContain('22 mins');
    expect(html).toContain('8.3 km');
  });
});
