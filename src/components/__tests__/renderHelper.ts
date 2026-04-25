import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, useQueryClient } from '@tanstack/react-query';

let _capturedClient: QueryClient | null = null;

function Capture() {
  _capturedClient = useQueryClient();
  return null;
}

/**
 * Renders a QueryProvider and captures the QueryClient it provides.
 */
export async function render(
  QueryProvider: React.ComponentType<{ children: React.ReactNode }>
): Promise<QueryClient> {
  _capturedClient = null;
  renderToString(
    createElement(QueryProvider, null, createElement(Capture))
  );
  if (!_capturedClient) {
    throw new Error('QueryClient was not captured');
  }
  return _capturedClient;
}
