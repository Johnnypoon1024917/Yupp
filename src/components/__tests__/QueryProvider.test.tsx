import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

/**
 * We test QueryProvider by importing it and verifying it renders without error.
 * Since we can't easily inspect QueryClient defaults from the outside in a unit test,
 * we verify the component renders children correctly and doesn't throw.
 *
 * For deeper config verification, we import the module and inspect the QueryClient
 * created by the provider via a test wrapper.
 */

// We need to test the QueryClient configuration. We'll do this by creating
// a small test component that reads the queryClient from context.
import { useQueryClient, QueryClient } from '@tanstack/react-query';

let capturedClient: QueryClient | null = null;

function ClientCapture() {
  capturedClient = useQueryClient();
  return createElement('div', null, 'captured');
}

describe('QueryProvider', () => {
  it('renders children and provides a QueryClient', async () => {
    // Dynamic import to avoid SSR issues with 'use client'
    const { default: QueryProvider } = await import('../QueryProvider');

    // Use a simple render approach
    const { renderToStaticMarkup } = await import('react-dom/server');

    const html = renderToStaticMarkup(
      createElement(QueryProvider, null, createElement('span', null, 'hello'))
    );

    expect(html).toContain('hello');
  });

  it('configures staleTime to 300_000', async () => {
    const { default: QueryProvider } = await import('../QueryProvider');
    const { render } = await import('./renderHelper');

    const client = await render(QueryProvider);
    const defaults = client.getDefaultOptions();

    expect(defaults.queries?.staleTime).toBe(300_000);
  });

  it('configures retry to 2', async () => {
    const { default: QueryProvider } = await import('../QueryProvider');
    const { render } = await import('./renderHelper');

    const client = await render(QueryProvider);
    const defaults = client.getDefaultOptions();

    expect(defaults.queries?.retry).toBe(2);
  });

  it('configures refetchOnWindowFocus to false', async () => {
    const { default: QueryProvider } = await import('../QueryProvider');
    const { render } = await import('./renderHelper');

    const client = await render(QueryProvider);
    const defaults = client.getDefaultOptions();

    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });
});
