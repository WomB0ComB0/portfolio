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
  defaultShouldDehydrateQuery,
  MutationCache,
  QueryCache,
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
 * Instantiates (and memoizes per invocation context) a configured TanStack QueryClient instance
 * for use on the server-side. This QueryClient setup attaches logging for query and mutation
 * lifecycle events and custom serialization using SuperJSON.
 *
 * Uses React's `cache` utility to ensure a stable instance per execution context on the server.
 *
 * @function createQueryClient
 * @returns {QueryClient} A strongly-typed, memoized instance of QueryClient
 * @throws {Error} If QueryClient instantiation fails unexpectedly
 * @see {@link https://tanstack.com/query/v4/docs/framework/react/reference/QueryClient TanStack QueryClient Documentation}
 * @see {@link https://github.com/WomB0ComB0/portfolio Portfolio Repository}
 * @example
 * // Get a QueryClient instance
 * const queryClient = createQueryClient();
 * @readonly
 * @public
 * @web
 * @version 1.0.0
 * @author Mike Odnis <WomB0ComB0>
 */
export const createQueryClient = cache(() => {
  let queryClient: QueryClient | null = null;

  /**
   * Returns a singleton QueryClient instance for the server context.
   *
   * @returns {QueryClient} A server-safe QueryClient instance
   * @throws {Error} If QueryClient configuration fails
   * @example
   * const qc = createQueryClient();
   */
  return (): QueryClient => {
    queryClient ??= new QueryClient({
      queryCache: new QueryCache({
        /**
         * Handles errors encountered during server-side queries.
         * @param {unknown} error - The error thrown by the query.
         * @param {import('@tanstack/react-query').Query} query - The Query that caused the error.
         * @returns {void}
         */
        onError: (error, query) => {
          logger.error(`Query error: ${error}`, query);
        },
        /**
         * Handles successful query results.
         * @param {unknown} data - The resolved data from the query.
         * @param {import('@tanstack/react-query').Query} query - The Query that succeeded.
         * @returns {void}
         */
        onSuccess: (data, query) => {
          logger.debug(`Query success`, { data, query });
        },
        /**
         * Handles settled queries, regardless of outcome.
         * @param {unknown} data
         * @param {unknown} error
         * @param {import('@tanstack/react-query').Query} query
         * @returns {void}
         */
        onSettled: (data, error, query) => {
          logger.debug(`Query settled`, { data, error, query });
        },
      }),
      mutationCache: new MutationCache({
        /**
         * Handles errors in mutation executions.
         * @param {Error} error
         * @returns {Promise<void>}
         */
        onError: (error) => {
          logger.error(`Mutation error: ${error}`, {
            message: error.message,
            stack: error.stack,
          });
          return Promise.resolve();
        },
        /**
         * Logs successful mutation executions.
         * @param {unknown} data
         * @param {unknown} variables
         * @param {unknown} context
         * @param {import('@tanstack/react-query').Mutation | undefined} mutation
         * @returns {Promise<void>}
         */
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
      }),
      defaultOptions: {
        queries: {
          /**
           * One retry layer for queries: their fetches should pass `retries: 0` and leave
           * retrying to this. TanStack's default delay (1 s, doubling) applies.
           */
          retry: shouldRetryQuery,
        },
        dehydrate: {
          /**
           * Serializes dehydratable data in a type-safe manner with SuperJSON.
           * @param {unknown} data
           * @returns {string}
           */
          serializeData: SuperJSON.serialize,
          /**
           * Determines if a query should be dehydrated.
           * @param {import('@tanstack/react-query').Query} query
           * @returns {boolean}
           */
          shouldDehydrateQuery: (query) =>
            defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
        },
        hydrate: {
          /**
           * Deserializes hydrated data from SuperJSON.
           * @param {string} data
           * @returns {unknown}
           */
          deserializeData: SuperJSON.deserialize,
        },
      },
    });
    return queryClient;
  };
});
