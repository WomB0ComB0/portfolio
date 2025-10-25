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

import { ClientError, Loader } from '@/components/client';
import {
  fetcher,
  FetcherError,
  type FetcherOptions,
  get,
  type QueryParams,
  requestQueue,
  ValidationError,
} from '@/lib/http-clients';
import { logger, parseCodePathDetailed } from '@/utils';
import { FetchHttpClient } from '@effect/platform';
import type { QueryKey } from '@tanstack/react-query';
import {
  useQueryClient,
  useSuspenseQuery,
  type UseSuspenseQueryOptions,
} from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import React, { Suspense, useCallback, useMemo } from 'react';

/**
 * @module effect-data-loader
 *
 * Enhanced DataLoader for React using React Query, Effect, and Effect Schema validation.
 *
 * This module provides a generic, type-safe React component and hook for loading data asynchronously
 * with advanced error handling, runtime validation, caching, and developer experience. It is designed
 * to work with Effect, Effect Schema, and React Query, supporting features like retries, timeouts,
 * schema validation, optimistic updates, and more.
 *
 * ## Features
 * - Type-safe data loading for React components with Effect Schema validation
 * - Suspense support
 * - Runtime type validation with detailed error messages
 * - Customizable error and loading components
 * - Query caching and invalidation
 * - Optimistic updates
 * - Retry and timeout logic
 * - Render props and hook API
 * @see DataLoader
 * @see useDataLoader
 * @example
 * ```tsx
 * import { DataLoader } from './effect-data-loader';
 * import { Schema } from 'effect';
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 *   email: Schema.String
 * });
 *
 * function UserList() {
 *   return (
 *     <DataLoader url="/api/users" schema={UserSchema}>
 *       {(users) => (
 *         <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
 *       )}
 *     </DataLoader>
 *   );
 * }
 * ```
 */
/**
 * Enhanced render props with additional query state and actions.
 *
 * @template T The type of the loaded data.
 */
export interface DataLoaderRenderProps<T> {
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Whether the query is currently refetching */
  isRefetching: boolean;
  /** Query client for advanced operations */
  queryClient: ReturnType<typeof useQueryClient>;
  /** Invalidate this query's cache */
  invalidate: () => Promise<void>;
  /** Set query data optimistically */
  setQueryData: (data: T | ((prev: T) => T)) => void;
}

/**
 * Base props for DataLoader without schema.
 */
export interface BaseDataLoaderProps<T> {
  /** Additional props */
  [key: string]: unknown;
  /** URL to fetch data from */
  url: string;
  /** Additional React Query options */
  queryOptions?: Partial<UseSuspenseQueryOptions<T, Error, T, QueryKey>>;
  /** Custom loading component */
  LoadingComponent?: React.ReactNode;
  /** Custom error component */
  ErrorComponent?: React.ComponentType<{ error: Error; retry: () => void }> | React.ReactElement;
  /** Fetcher options (retries, timeout, etc.) */
  options?: FetcherOptions<T>;
  /** Query parameters */
  params?: QueryParams;
  /** Custom query key override */
  queryKey?: QueryKey;
  /** Callback fired when data is successfully loaded */
  onSuccess?: (data: T) => void;
  /** Callback fired when an error occurs */
  onError?: (error: Error) => void;
  /** Transform the data before passing to children */
  transform?: (data: any) => T;
  /** Stale time in milliseconds (default: 5 minutes) */
  staleTime?: number;
  /** Refetch interval in milliseconds or false to disable (default: 5 minutes) */
  refetchInterval?: number | false;
  /** Whether to refetch on window focus (default: false) */
  refetchOnWindowFocus?: boolean;
  /** Whether to refetch on reconnect (default: true) */
  refetchOnReconnect?: boolean;
}

/**
 * Props for DataLoader without schema (manual typing).
 */
export interface DataLoaderProps<T> extends BaseDataLoaderProps<T> {
  /**
   * Render prop that receives data and optional utilities.
   */
  children:
    | ((data: T) => React.ReactNode)
    | ((data: T, utils: DataLoaderRenderProps<T>) => React.ReactNode);
  /** Effect Schema for runtime validation (optional) */
  schema?: never;
}

/**
 * Props for DataLoader with Effect Schema (automatic type inference).
 */
export interface DataLoaderPropsWithSchema<S extends Schema.Schema<any, any, never>>
  extends BaseDataLoaderProps<Schema.Schema.Type<S>> {
  /**
   * Render prop that receives validated data and optional utilities.
   */
  children:
    | ((data: Schema.Schema.Type<S>) => React.ReactNode)
    | ((
        data: Schema.Schema.Type<S>,
        utils: DataLoaderRenderProps<Schema.Schema.Type<S>>,
      ) => React.ReactNode);
  /** Effect Schema for runtime validation */
  schema: S;
  /** Fetcher options with schema */
  options?: FetcherOptions<Schema.Schema.Type<S>> & { schema: S };
}

/**
 * Enhanced DataLoader component with Effect Schema validation, better error handling, caching, and developer experience.
 *
 * @example Without schema
 * ```tsx
 * <DataLoader<User[]> url="/api/users">
 *   {(users) => <UserList users={users} />}
 * </DataLoader>
 * ```
 *
 * @example With schema (automatic type inference)
 * ```tsx
 * const UsersSchema = Schema.Array(Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 *   email: Schema.String
 * }));
 *
 * <DataLoader url="/api/users" schema={UsersSchema}>
 *   {(users) => <UserList users={users} />} // users is fully typed!
 * </DataLoader>
 * ```
 */
export function DataLoader<T = unknown>(props: DataLoaderProps<T>): React.ReactElement;
export function DataLoader<S extends Schema.Schema<any, any, never>>(
  props: DataLoaderPropsWithSchema<S>,
): React.ReactElement;
export function DataLoader<T = unknown, S extends Schema.Schema<any, any, never> = any>({
  children,
  url,
  queryOptions = {},
  LoadingComponent = <Loader />,
  ErrorComponent = ClientError,
  options = {},
  params = {},
  queryKey,
  onSuccess,
  onError,
  transform,
  staleTime = 1_000 * 60 * 5, // 5 minutes
  refetchInterval = 1_000 * 60 * 5, // 5 minutes
  refetchOnWindowFocus = false,
  refetchOnReconnect = true,
  schema,
}: (DataLoaderProps<T> | DataLoaderPropsWithSchema<S>) & {
  schema?: S;
}): React.ReactElement {
  const queryClient = useQueryClient();

  // Generate stable query key including schema
  const finalQueryKey = useMemo(() => {
    if (queryKey) return queryKey;
    const headers = options?.headers;
    const timeout = options?.timeout;
    const schemaKey = schema ? `schema:${Schema.format(schema)}` : null;
    const keyArray = ['dataloader', url, params, headers, timeout, schemaKey].filter(Boolean);
    return keyArray;
  }, [queryKey, url, params, options, schema]);

  // Enhanced fetcher options with better defaults and schema support
  const fetcherOptions = useMemo((): FetcherOptions<any> => {
    const baseOptions: FetcherOptions<any> = {
      retries: 3,
      retryDelay: 1_000,
      timeout: 30_000,
      onError: (err) => {
        const path = parseCodePathDetailed(url, fetcher);
        logger.info(`[DataLoader]: ${path}`);

        if (err instanceof FetcherError) {
          logger.error(`[DataLoader]: Status ${err.status}`, err.responseData);
        } else if (err instanceof ValidationError) {
          logger.error(`[DataLoader]: Validation failed - ${err.getProblemsString()}`);
          logger.error(`[DataLoader]: Invalid data:`, err.responseData);
        } else {
          logger.error('[DataLoader]: Unexpected error', err);
        }

        // Call user-provided error handler
        if (onError && err instanceof Error) onError(err);
      },
      ...(options || {}),
    };

    if (schema) return { ...baseOptions, schema };

    return baseOptions;
  }, [url, options, onError, schema]);

  // Memoized query function with schema support and request deduplication
  const queryFn = useCallback(async () => {
    try {
      // Wrap the Effect execution in the request queue for automatic deduplication
      const result = await requestQueue.enqueue(
        url,
        'GET',
        async () => {
          const effect = pipe(
            get(url, fetcherOptions, params),
            Effect.provide(FetchHttpClient.layer),
          );
          return await Effect.runPromise(effect);
        },
        {
          headers: fetcherOptions?.headers,
          bypassDeduplication: false,
        },
      );

      // Apply transformation if provided (note: schema validation happens first)
      const finalResult = transform && typeof transform === 'function' ? transform(result) : result;

      // Call success callback
      if (onSuccess) onSuccess(finalResult as any);

      return finalResult;
    } catch (error) {
      // Enhanced error handling for validation errors
      if (error instanceof ValidationError) throw error;

      if (error instanceof FetcherError) throw error;

      // Wrap unexpected errors
      throw new FetcherError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        url,
        undefined,
        error,
      );
    }
  }, [url, fetcherOptions, params, transform, onSuccess]);

  // Enhanced query options
  const queryOptionsWithDefaults = useMemo(() => {
    const baseOptions: UseSuspenseQueryOptions<any, Error, any, QueryKey> = {
      queryKey: finalQueryKey as QueryKey,
      queryFn,
      staleTime,
      refetchInterval,
      refetchOnWindowFocus,
      refetchOnReconnect,
      retry: (failureCount: number, error: unknown) => {
        // Don't retry client errors (4xx)
        if (
          error instanceof ValidationError ||
          (error instanceof FetcherError &&
            error.status &&
            error.status >= 400 &&
            error.status < 500)
        )
          return false;

        return failureCount < 3;
      },
      retryDelay: (attemptIndex: number) => Math.min(1_000 * 2 ** attemptIndex, 30_000),
      ...queryOptions,
    };

    return baseOptions;
  }, [
    finalQueryKey,
    queryFn,
    staleTime,
    refetchInterval,
    refetchOnWindowFocus,
    refetchOnReconnect,
    queryOptions,
  ]);

  const { data, error, refetch, isRefetching } = useSuspenseQuery(queryOptionsWithDefaults);

  // Enhanced render props
  const renderProps = useMemo(() => {
    const props: DataLoaderRenderProps<any> = {
      refetch: async () => {
        await refetch();
      },
      isRefetching,
      queryClient,
      invalidate: async () => {
        await queryClient.invalidateQueries({ queryKey: finalQueryKey });
      },
      setQueryData: (newData: any) => {
        queryClient.setQueryData(finalQueryKey, newData);
      },
    };
    return props;
  }, [refetch, isRefetching, queryClient, finalQueryKey]);

  // Enhanced error component with retry capability and validation error support
  const renderError = useCallback(
    (error: Error) => {
      if (React.isValidElement(ErrorComponent)) {
        return React.cloneElement(ErrorComponent as React.ReactElement<any>, {
          error,
          retry: () => refetch(),
        });
      }

      const Component = ErrorComponent as React.ComponentType<{
        error: Error;
        retry: () => void;
      }>;
      return <Component error={error} retry={() => refetch()} />;
    },
    [ErrorComponent, refetch],
  );

  // Determine how to call children function
  const renderChildren = useCallback(() => {
    if (typeof children === 'function') {
      // Check if it's a function that accepts 2 parameters (data + utils)
      try {
        const result =
          children.length > 1 ? (children as any)(data, renderProps) : (children as any)(data);
        return result;
      } catch {
        // Fallback to simple call if inspection fails
        return (children as any)(data);
      }
    }
    return null;
  }, [children, data, renderProps]);

  return (
    <Suspense fallback={LoadingComponent}>{error ? renderError(error) : renderChildren()}</Suspense>
  );
}

DataLoader.displayName = 'DataLoader';

/**
 * Hook version of DataLoader for use outside of JSX.
 */
export function useDataLoader<T = unknown>(
  url: string,
  options?: Omit<DataLoaderProps<T>, 'children' | 'LoadingComponent' | 'ErrorComponent'>,
): ReturnType<typeof useSuspenseQuery<T, Error, T, QueryKey>>;

export function useDataLoader<S extends Schema.Schema<any, any, never>>(
  url: string,
  options: Omit<DataLoaderPropsWithSchema<S>, 'children' | 'LoadingComponent' | 'ErrorComponent'>,
): ReturnType<
  typeof useSuspenseQuery<Schema.Schema.Type<S>, Error, Schema.Schema.Type<S>, QueryKey>
>;

export function useDataLoader(url: string, options: any = {}) {
  const {
    queryOptions = {},
    options: fetcherOptions = {},
    params = {},
    queryKey,
    onSuccess,
    onError,
    transform,
    staleTime = 1_000 * 60 * 5,
    refetchInterval = 1_000 * 60 * 5,
    refetchOnWindowFocus = false,
    refetchOnReconnect = true,
    schema,
  } = options;

  const finalQueryKey = useMemo(() => {
    if (queryKey) return queryKey;
    const headers = fetcherOptions?.headers;
    const timeout = fetcherOptions?.timeout;
    const schemaKey = schema ? `schema:${Schema.format(schema)}` : null;
    const keyArray = ['dataloader', url, params, headers, timeout, schemaKey].filter(Boolean);
    return keyArray;
  }, [queryKey, url, params, fetcherOptions, schema]);

  const enhancedFetcherOptions = useMemo(() => {
    const baseOptions: FetcherOptions<any> = {
      retries: 3,
      retryDelay: 1_000,
      timeout: 30_000,
      onError: (err) => {
        if (err instanceof ValidationError) {
          logger.error(`[useDataLoader]: Validation failed - ${err.getProblemsString()}`);
        }

        if (typeof onError === 'function' && err instanceof Error) {
          onError(err);
        }
      },
      ...(fetcherOptions || {}),
    };

    if (schema) {
      return { ...baseOptions, schema };
    }

    return baseOptions;
  }, [fetcherOptions, onError, schema]);

  const queryFn = useCallback(async () => {
    // Wrap the Effect execution in the request queue for automatic deduplication
    const result = await requestQueue.enqueue(
      url,
      'GET',
      async () => {
        const effect = pipe(
          get(url, enhancedFetcherOptions, params as QueryParams),
          Effect.provide(FetchHttpClient.layer),
        );
        return await Effect.runPromise(effect);
      },
      {
        headers: enhancedFetcherOptions?.headers,
        bypassDeduplication: false,
      },
    );

    const finalResult = transform && typeof transform === 'function' ? transform(result) : result;

    if (typeof onSuccess === 'function') {
      onSuccess(finalResult);
    }

    return finalResult;
  }, [url, enhancedFetcherOptions, params, transform, onSuccess]);

  const queryOptionsWithDefaults = useMemo(() => {
    const baseOptions: UseSuspenseQueryOptions<any, Error, any, QueryKey> = {
      queryKey: finalQueryKey as QueryKey,
      queryFn,
      staleTime,
      refetchInterval,
      refetchOnWindowFocus,
      refetchOnReconnect,
      retry: (failureCount: number, error: unknown) => {
        if (
          error instanceof ValidationError ||
          (error instanceof FetcherError &&
            error.status &&
            error.status >= 400 &&
            error.status < 500)
        ) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex: number) => Math.min(1_000 * 2 ** attemptIndex, 30_000),
      ...queryOptions,
    };

    return baseOptions;
  }, [
    finalQueryKey,
    queryFn,
    staleTime,
    refetchInterval,
    refetchOnWindowFocus,
    refetchOnReconnect,
    queryOptions,
  ]);

  return useSuspenseQuery(queryOptionsWithDefaults);
}

export default DataLoader;
