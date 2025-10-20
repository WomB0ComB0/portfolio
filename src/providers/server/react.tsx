/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use client';

import { edenFetch } from '@elysiajs/eden';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { API } from '@/app/api/[[...route]]/route';
import type { API_V1 } from '@/app/api/v1';
import { getURL } from '@/utils';
import { createQueryClient } from '.';

/**
 * Instantiates a type-safe, client-side Elysia treaty API instance for all endpoints.
 *
 * @readonly
 * @type {import('@elysiajs/eden').EdenFetch<API>}
 * @public
 * @web
 * @author Mike Odnis <WomB0ComB0>
 * @see {@link https://elysiajs.com/eden/treaty.html Eden Treaty Documentation}
 * @see {@link https://github.com/WomB0ComB0/portfolio Portfolio Repository}
 * @version 1.0.0
 * @remarks
 * Sets the API base URL based on the execution context:
 *   - Server-side: Uses getURL()
 *   - Client-side: Uses window.location.origin
 * Provides type-safe access to all API endpoints.
 * @example
 * * const users = await elysia_api.exampleRoute.get();
 * ```
 */
export const elysia_api = edenFetch<API>(
  typeof window === 'undefined' ? getURL() : window.location.origin,
);

/**
 * Instantiates a type-safe, client-side Elysia treaty API instance for v1 endpoints.
 *
 * @readonly
 * @type {import('@elysiajs/eden').EdenFetch<API_V1>}
 * @public
 * @web
 * @author Mike Odnis <WomB0ComB0>
 * @see {@link https://elysiajs.com/eden/treaty.html Eden Treaty Documentation}
 * @see {@link https://github.com/WomB0ComB0/portfolio Portfolio Repository}
 * @version 1.0.0
 * @remarks
 * Configures base URL based on execution context (SSR or browser).
 * Used for API v1 endpoints.
 * @example
 * ```ts
 * const data = await elysia_apiv1.someV1Route.get();
 * ```
 */
export const elysia_apiv1 = edenFetch<API_V1>(
  typeof window === 'undefined' ? getURL() : window.location.origin,
);

/**
 * Singleton instance container for QueryClient on the client side.
 *
 * @type {QueryClient | undefined}
 * @private
 * @readonly
 * @author Mike Odnis <WomB0ComB0>
 * @version 1.0.0
 * @remarks
 * Used to preserve React Query cache across client renders.
 */
let clientQueryClientSingleton: QueryClient | undefined;

/**
 * Resolves a QueryClient instance appropriate for the execution context.
 *
 * @function
 * @returns {QueryClient} QueryClient instance (per-request for SSR, singleton for client)
 * @throws {Error} Throws if QueryClient creation fails unexpectedly
 * @public
 * @readonly
 * @author Mike Odnis <WomB0ComB0>
 * @version 1.0.0
 * @see {@link https://tanstack.com/query/v4/docs/framework/react/overview React Query Overview}
 * @remarks
 * - On the server: always returns a new QueryClient to avoid shared state.
 * - On the client: creates/persists a singleton for consistent cache and state.
 * @example
 * ```ts
 * const queryClient = getQueryClient();
 * ```
 */
const getQueryClient = (): QueryClient => {
  if (typeof window === 'undefined') {
    return createQueryClient();
  }
  return (clientQueryClientSingleton ??= createQueryClient());
};

/**
 * Provides the React Query QueryClient context and devtools to its children.
 *
 * @component
 * @param {React.PropsWithChildren} props - Component props
 * @param {React.ReactNode} props.children - Elements to render within the QueryClientProvider context
 * @returns {JSX.Element} Provider context for React Query with devtools enabled (disabled by default)
 * @public
 * @readonly
 * @web
 * @throws {Error} May throw if QueryClient instantiation fails
 * @author Mike Odnis <WomB0ComB0>
 * @version 1.0.0
 * @see {@link https://tanstack.com/query/v4/ React Query Documentation}
 * @example
 * ```tsx
 * <QueryProvider>
 *   <App />
 * </QueryProvider>
 * ```
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
