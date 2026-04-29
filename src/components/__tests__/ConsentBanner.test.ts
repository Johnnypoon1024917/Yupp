// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

// Mock next/link to render a plain <a>
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    createElement('a', { href, ...rest }, children),
}));

// jsdom localStorage polyfill
if (typeof globalThis.localStorage?.clear !== 'function') {
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
    writable: true,
    configurable: true,
  });
}

import ConsentBanner from '@/components/ConsentBanner';

describe('ConsentBanner', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('analytics_consent');
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  function renderBanner() {
    const root = createRoot(container);
    act(() => {
      root.render(createElement(ConsentBanner));
    });
    return root;
  }

  it('is visible when no localStorage consent exists', () => {
    renderBanner();
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
  });

  it('is hidden after accept and sets localStorage to granted', () => {
    renderBanner();
    const acceptBtn = container.querySelector('button');
    expect(acceptBtn?.textContent).toContain('Accept');
    act(() => { acceptBtn?.click(); });
    expect(localStorage.getItem('analytics_consent')).toBe('granted');
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });

  it('is hidden after decline and sets localStorage to denied', () => {
    renderBanner();
    const buttons = container.querySelectorAll('button');
    const declineBtn = buttons[1]; // second button is Decline
    expect(declineBtn?.textContent).toContain('Decline');
    act(() => { declineBtn?.click(); });
    expect(localStorage.getItem('analytics_consent')).toBe('denied');
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });

  it('is not visible when consent already exists in localStorage', () => {
    localStorage.setItem('analytics_consent', 'granted');
    renderBanner();
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });
});
