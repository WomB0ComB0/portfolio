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

import {
  type DefaultOptions,
  defaultShouldDehydrateQuery,
  MutationCache,
  type MutationCacheConfig,
  QueryCache,
  type QueryCacheConfig,
  QueryClient,
} from '@tanstack/react-query';
import { Cause, Runtime } from 'effect';
import { cache } from 'react';
import SuperJSON from 'superjson';
import { ValidationError } from '@/lib/http-clients/effect-fetcher';
import { logger } from '@/utils';

/** Retries a failing query gets in the browser. Its queryFn's fetch should not retry as well. */
export const MAX_BROWSER_QUERY_RETRIES = 1;

/**
 * Returns the error an Effect failed with. `Effect.runPromise` rejects with a FiberFailure that
 * keeps the original error (e.g. the fetcher's FetcherError, with its status) in its Cause.
 * Anything else is returned unchanged.
 */
export const unwrapEffectError = (error: unknown): unknown =>
  Runtime.isFiberFailure(error) ? Cause.squash(error[Runtime.FiberFailureCauseId]) : error;

/** The HTTP status an error carries, such as FetcherError's `status`, if it has a numeric one. */
const statusOf = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  return typeof error.status === 'number' ? error.status : undefined;
};

/** 4xx responses (429 included) and schema mismatches: asking again gets the same answer. */
const isClientError = (error: unknown): boolean => {
  if (error instanceof ValidationError) return true;
  const status = statusOf(error);
  return status !== undefined && status >= 400 && status < 500;
};

/**
 * TanStack Query `retry` predicate shared by every query. In the browser a failing query is
 * retried once (network errors, timeouts, 5xx and unknown errors) and client errors never are;
 * on the server nothing is retried, matching TanStack's own server default.
 *
 * @param failureCount - Retries already made: TanStack passes 0 after the first failure.
 * @param error - What the queryFn threw; a FiberFailure from `Effect.runPromise` is unwrapped.
 * @param onServer - Whether this runs without a browser window. Tests pass it explicitly.
 * @returns Whether TanStack should run the queryFn again.
 */
export const shouldRetryQuery = (
  failureCount: number,
  error: unknown,
  onServer: boolean = globalThis.window === undefined,
): boolean => {
  if (onServer || failureCount >= MAX_BROWSER_QUERY_RETRIES) return false;
  return !isClientError(unwrapEffectError(error));
};

/**
 * Query lifecycle logging. Only callbacks live here: each client gets its own QueryCache built
 * from this config, so no two clients ever share cached queries.
 */
const QUERY_CACHE_CONFIG: QueryCacheConfig = {
  onError: (error, query) => {
    logger.error(`Query error: ${error}`, query);
  },
  onSuccess: (data, query) => {
    logger.debug(`Query success`, { data, query });
  },
  onSettled: (data, error, query) => {
    logger.debug(`Query settled`, { data, error, query });
  },
};

/** Mutation lifecycle logging. Like {@link QUERY_CACHE_CONFIG}, a config, never a shared cache. */
const MUTATION_CACHE_CONFIG: MutationCacheConfig = {
  onError: (error) => {
    logger.error(`Mutation error: ${error}`, {
      message: error.message,
      stack: error.stack,
    });
    return Promise.resolve();
  },
  onSuccess: (data, variables, context, mutation) => {
    logger.info('Mutation succeeded', {
      data,
      variables,
      context,
      mutationKey: mutation?.options?.mutationKey,
      mutationFn: mutation?.options?.mutationFn?.name || 'anonymous',
    });
    return Promise.resolve();
  },
};

/**
 * Defaults every client starts with. The server's dehydrate and the browser's hydrate both come
 * from here, so prefetched data is written and read with the same SuperJSON transformer.
 */
const DEFAULT_OPTIONS: DefaultOptions = {
  queries: {
    /**
     * One retry layer for queries: their fetches should pass `retries: 0` and leave retrying to
     * this. TanStack's default delay (1 s, doubling) applies.
     */
    retry: shouldRetryQuery,
  },
  dehydrate: {
    serializeData: SuperJSON.serialize,
    /** Successful queries, plus pending ones (callers await their prefetches, so none should be). */
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
  },
  hydrate: {
    deserializeData: SuperJSON.deserialize,
  },
};

/**
 * Builds a NEW QueryClient with the site's defaults on every call. Server code that prefetches
 * for one render (see `PrefetchBoundary` in '@/lib/query/prefetch') uses this, so requests never
 * share a cache.
 *
 * @returns A fresh QueryClient with its own query and mutation caches.
 */
export const makeQueryClient = (): QueryClient =>
  new QueryClient({
    queryCache: new QueryCache(QUERY_CACHE_CONFIG),
    mutationCache: new MutationCache(MUTATION_CACHE_CONFIG),
    defaultOptions: DEFAULT_OPTIONS,
  });

/**
 * Instantiates (and memoizes per invocation context) a configured TanStack QueryClient instance.
 * The client attaches logging for query and mutation lifecycle events and serializes with
 * SuperJSON (see {@link makeQueryClient}).
 *
 * Uses React's `cache` utility to ensure a stable instance per execution context on the server.
 * In a client component `cache()` memoizes nothing, so every call builds a new client; the
 * browser keeps one client per page load in a module variable (see `getQueryClient` in
 * src/app/_providers/global-provider.tsx). Not in React state: a first hydration that suspends
 * discards that state, and the queries the discarded render started go with its client.
 *
 * @function createQueryClient
 * @returns A getter for a memoized QueryClient: `createQueryClient()()`.
 * @see {@link https://tanstack.com/query/v5/docs/reference/QueryClient TanStack QueryClient Documentation}
 * @example
 * const queryClient = createQueryClient()();
 * @public
 * @author Mike Odnis <WomB0ComB0>
 */
export const createQueryClient = cache(() => {
  let queryClient: QueryClient | null = null;

  /** Returns this context's QueryClient, building it on the first call. */
  return (): QueryClient => {
    queryClient ??= makeQueryClient();
    return queryClient;
  };
});
