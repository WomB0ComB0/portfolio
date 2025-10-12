'use client';

import type { HonoApp } from '@/app/api/[[...route]]/route';
import type { App } from '@/app/api/v1/[[...routes]]/route';
import { getURL } from '@/utils';
import { edenFetch } from '@elysiajs/eden';
import { hc } from 'hono/client';

import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createQueryClient } from '.';

/**
 * Client API instance created using Elysia's treaty.
 * This provides type-safe API endpoints based on the ElysiaRouter type.
 *
 * @remarks
 * The API instance is initialized with different base URLs depending on the environment:
 * - In server-side context (window undefined): Uses getURL()
 * - In client-side context: Uses the current window.location.origin
 *
 * @type {App} - The typed API router instance
 */
export const elysia_api = edenFetch<App>(
  typeof window === 'undefined' ? getURL() : window.location.origin,
);
export const hono_api = hc<HonoApp>(
  typeof window === 'undefined' ? getURL() : window.location.origin,
);

/**
 * Singleton instance of QueryClient to ensure consistent caching across the application.
 * This is only initialized on the client side to prevent shared state between requests.
 *
 * @type {QueryClient | undefined} - The singleton QueryClient instance
 * @private
 */
let clientQueryClientSingleton: QueryClient | undefined = undefined;

/**
 * Get or create a QueryClient instance based on the execution context.
 *
 * @remarks
 * This function handles two scenarios:
 * 1. Server-side: Creates a new QueryClient instance for each request to prevent shared state
 * 2. Client-side: Returns or initializes a singleton QueryClient instance
 *
 * The singleton pattern on the client side ensures that:
 * - Cache is preserved between re-renders
 * - Prevents memory leaks from multiple instances
 * - Maintains consistent query state across the application
 *
 * @returns {QueryClient} A QueryClient instance appropriate for the current context
 */
const getQueryClient = (): QueryClient => {
  if (typeof window === 'undefined') {
    return createQueryClient();
  }
  return (clientQueryClientSingleton ??= createQueryClient());
};

/**
 * React component that provides QueryClient context to the application.
 *
 * @remarks
 * This component wraps the application with necessary React Query infrastructure:
 * - QueryClientProvider: Provides the QueryClient instance to all child components
 * - ReactQueryDevtools: Development tools for debugging queries (disabled by default)
 *
 * The QueryClient is managed through getQueryClient() which handles:
 * - Server-side rendering considerations
 * - Client-side singleton management
 * - Proper cache isolation between requests
 *
 * @example
 * ```tsx
 * <QueryProvider>
 *   <App />
 * </QueryProvider>
 * ```
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to be wrapped with the QueryClient context
 * @returns {React.JSX.Element} A QueryClientProvider component with configured QueryClient and dev tools
 */
export const QueryProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};
