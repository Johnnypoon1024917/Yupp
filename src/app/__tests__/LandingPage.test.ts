// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

// Mock next/link to render a plain <a>
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    createElement('a', { href, ...rest }, children),
}));

// Mock lucide-react icons to render simple spans
vi.mock('lucide-react', () => ({
  MapPin: (props: Record<string, unknown>) => createElement('span', { 'data-icon': 'MapPin', ...props }),
  Sparkles: (props: Record<string, unknown>) => createElement('span', { 'data-icon': 'Sparkles', ...props }),
  Calendar: (props: Record<string, unknown>) => createElement('span', { 'data-icon': 'Calendar', ...props }),
}));

// Mock LandingScrollTracker to render nothing
vi.mock('@/components/LandingScrollTracker', () => ({
  default: () => null,
}));

import LandingPage from '@/app/page';

describe('Landing Page CTA links', () => {
  it('all CTA links (a[href="/app"]) point to /app', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(createElement(LandingPage));
    });

    const ctaLinks = container.querySelectorAll('a[href="/app"]');
    expect(ctaLinks.length).toBeGreaterThanOrEqual(2); // Hero CTA + Bottom CTA + footer "Open App"

    ctaLinks.forEach((link) => {
      expect(link.getAttribute('href')).toBe('/app');
    });

    act(() => { root.unmount(); });
    document.body.removeChild(container);
  });
});
