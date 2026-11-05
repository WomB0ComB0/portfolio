'use client';

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

import { FetchHttpClient } from '@effect/platform';
import type { QueryKey } from '@tanstack/react-query';
import {
  QueryErrorResetBoundary,
  type UseSuspenseQueryOptions,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { unstable_rethrow } from 'next/navigation';
import React, { Suspense, useCallback, useMemo } from 'react';
import { ClientError, Loader } from '@/components/client';
import { useIsServerHtmlRender } from '@/hooks/use-is-server-html-render';
import {
  FetcherError,
  type FetcherOptions,
  fetcher,
  get,
  type QueryParams,
  requestQueue,
  ValidationError,
} from '@/lib/http-clients';
import { reportError } from '@/lib/observability/report';
import { logger, parseCodePathDetailed } from '@/utils';
import { unwrapEffectError } from './query-client';

/**
 * @module effect-data-loader
 *
 * DataLoader: a React component that loads data in the browser with React Query, Effect and
 * Effect Schema validation. Pages render their own data on the server; DataLoader is for live
 * widgets that poll an API route (the /stats Discord card).
 *
 * ## Features
 * - Type-safe data loading with Effect Schema validation
 * - Never fetches during server rendering. Data a server component prefetched into the
 *   QueryClient (behind a HydrationBoundary) renders in the server HTML and hydrates as is;
 *   otherwise the server HTML holds `LoadingComponent` and the browser fetches once.
 * - Customizable error and loading components. A failed first load renders `ErrorComponent` in
 *   place of the children (it stops at the DataLoader, not the page's error boundary); a failed
 *   background refetch keeps the data already on screen.
 * - Query caching and invalidation, optimistic updates, render props
 * - Retries come from the QueryClient's shared rule (shouldRetryQuery)
 * @see DataLoader
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
 *     <DataLoader url="/api/users" schema={Schema.Array(UserSchema)}>
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

/** What DataLoader passes its `ErrorComponent`. */
export interface DataLoaderErrorProps {
  /** Why the first load failed. */
  error: Error;
  /** Clears the failure and loads the data again. */
  retry: () => void;
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
  /**
   * Shown while the first load is in flight, and in the server HTML unless the data was
   * prefetched on the server (default: the full-screen Loader).
   */
  LoadingComponent?: React.ReactNode;
  /** Shown in place of the children when the first load fails (after the query's retries). */
  ErrorComponent?: React.ComponentType<DataLoaderErrorProps> | React.ReactElement;
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

/** Renders `ErrorComponent`, given as a component or an element, with the failure and a retry. */
function renderErrorComponent(
  ErrorComponent: React.ComponentType<DataLoaderErrorProps> | React.ReactElement,
  error: Error,
  retry: () => void,
): React.ReactNode {
  if (React.isValidElement(ErrorComponent)) {
    return React.cloneElement(ErrorComponent as React.ReactElement<Partial<DataLoaderErrorProps>>, {
      error,
      retry,
    });
  }
  const Component = ErrorComponent as React.ComponentType<DataLoaderErrorProps>;
  return <Component error={error} retry={retry} />;
}

/**
 * Whether Sentry hears about a failure without this boundary's help. A FetcherError is an HTTP or
 * network failure: the API routes report their own upstream failures server-side
 * (reportApiFailure), and a visitor's dropped connection is not actionable. The QueryCache logs
 * every query error as well. A ValidationError (an answer the schema rejects) or a render bug in
 * the children is reported nowhere else, so the boundary reports those, as src/app/error.tsx did.
 */
const isReportedElsewhere = (error: unknown): boolean => error instanceof FetcherError;

/** Renders a failed load in place of the children, with a retry that loads again. */
export type LoadFailureFallback = (error: Error, retry: () => void) => React.ReactNode;

interface LoadFailureBoundaryProps {
  children: React.ReactNode;
  /** Renders the failure in place of the children. */
  fallback: LoadFailureFallback;
  /** Runs before the children render again: QueryErrorResetBoundary's `reset`. */
  onRetry: () => void;
}

interface LoadFailureBoundaryState {
  error: Error | null;
}

/**
 * Keeps a failed first load inside its DataLoader. useSuspenseQuery throws when it has no data to
 * show; without this boundary the error reaches src/app/error.tsx, which replaces the whole page.
 *
 * A query that awaits Effect.runPromise directly rejects with Effect's FiberFailure (DataLoader
 * unwraps it already), so the boundary unwraps it too: the fallback gets the fetcher's own error
 * (a FetcherError keeps its `status`), and the reporting rule sees it too. Next's notFound() and
 * redirect() pass through to Next's own boundaries.
 */
class LoadFailureBoundary extends React.Component<
  LoadFailureBoundaryProps,
  LoadFailureBoundaryState
> {
  state: LoadFailureBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): LoadFailureBoundaryState {
    unstable_rethrow(error);
    const failure = unwrapEffectError(error);
    return { error: failure instanceof Error ? failure : new Error(String(failure)) };
  }

  componentDidCatch(error: unknown): void {
    const failure = unwrapEffectError(error);
    if (!isReportedElsewhere(failure)) reportError(failure);
  }

  /** Lets the query fetch again on remount (TanStack keeps a thrown error otherwise), then remounts. */
  private readonly retry = (): void => {
    this.props.onRetry();
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    return error ? this.props.fallback(error, this.retry) : this.props.children;
  }
}

/**
 * The start of every query key DataLoader builds for `url` (unless the caller passes its own
 * `queryKey`). TanStack matches filters by prefix, so this key finds those queries whatever
 * params, timeout or schema they were built with.
 */
export const dataLoaderQueryKey = (url: string): QueryKey => ['dataloader', url];

/** The fetcher options that take part in a DataLoader's query key. */
interface KeyedFetcherOptions {
  readonly headers?: unknown;
  readonly timeout?: unknown;
}

/**
 * Names the schema a DataLoader decodes with, in its query key and as the request queue's
 * `resultKey`. Loaders of one URL that decode with different schemas (or none) then never share a
 * decoded result, while loaders that would share a cache entry may also share the request.
 */
const schemaKeyOf = (schema: Schema.Schema.AnyNoContext | undefined): string | undefined =>
  schema ? `schema:${Schema.format(schema)}` : undefined;

/**
 * DataLoader's defaults for its object props. Module constants, so a DataLoader that leaves them
 * out keeps one query key and one query function across renders.
 */
const NO_PARAMS: QueryParams = {};
const NO_FETCHER_OPTIONS: FetcherOptions<unknown> = {};
const NO_QUERY_OPTIONS: Partial<UseSuspenseQueryOptions<unknown, Error, unknown, QueryKey>> = {};

const DEFAULT_STALE_TIME_MS = 5 * 60 * 1_000;
const DEFAULT_REFETCH_INTERVAL_MS = 5 * 60 * 1_000;
const DEFAULT_TIMEOUT_MS = 30_000;

/** The props that decide which query a DataLoader reads. */
interface DataLoaderKeyProps {
  readonly url: string;
  readonly queryKey?: QueryKey;
  readonly params?: QueryParams;
  readonly options?: KeyedFetcherOptions;
  readonly schema?: Schema.Schema.AnyNoContext;
}

/**
 * The query key a DataLoader reads: the caller's own `queryKey`, or one built from the request
 * (url, params, headers, timeout and the schema it decodes with). DataLoader computes it once and
 * hands it to the gate, the query and the error boundary, so the server-render check, the fetch
 * and Try again all address the same cache entry.
 */
function useDataLoaderKey({
  url,
  queryKey,
  params = NO_PARAMS,
  options,
  schema,
}: DataLoaderKeyProps): QueryKey {
  return useMemo(() => {
    if (queryKey) return queryKey;
    const rest = [params, options?.headers, options?.timeout, schemaKeyOf(schema)];
    return [...dataLoaderQueryKey(url), ...rest.filter(Boolean)];
  }, [queryKey, url, params, options, schema]);
}

/** What QueryErrorBoundary takes: the children it guards and the error UI it shows instead. */
export interface QueryErrorBoundaryProps {
  children: React.ReactNode;
  /** Renders the failure in place of the children, with a retry that loads them again. */
  fallback: LoadFailureFallback;
  /**
   * The keys (or key prefixes, e.g. {@link dataLoaderQueryKey}) of the queries the children
   * read. Try again resets them first, so the children fetch them again: without this, children
   * whose render threw after a successful fetch would render the same cached data (and throw
   * again) until its staleTime ran out.
   */
  queryKeys?: readonly QueryKey[];
}

/**
 * DataLoader's error boundary: keeps a failed first load of a suspense query (useSuspenseQuery)
 * inside the widget that reads it, so the rest of the page stays and the fallback's retry loads
 * the query again. It is for client islands that fetch in the browser (a live widget polling an
 * API route); pages load their Sanity data on the server, and an outage there reaches
 * (routes)/error.tsx. Reporting is DataLoader's: a failed fetch is not reported again (the API
 * route reports its upstream failure), while an answer the schema rejects or a render bug is
 * reported once.
 *
 * Try again resets `queryKeys` (their cached data and error) before the children remount, so the
 * remount fetches them again rather than rendering data that already failed to render.
 *
 * @example As DataLoader uses it
 * ```tsx
 * <QueryErrorBoundary
 *   queryKeys={[queryKey]}
 *   fallback={(error, retry) => <ClientError error={error} retry={retry} />}
 * >
 *   <Suspense fallback={<Loader />}><LiveCard /></Suspense>
 * </QueryErrorBoundary>
 * ```
 */
export function QueryErrorBoundary({
  children,
  fallback,
  queryKeys,
}: QueryErrorBoundaryProps): React.ReactElement {
  const queryClient = useQueryClient();

  // The children are unmounted while the fallback shows, so their queries have no observers and
  // resetQueries only clears them (it refetches active queries alone); the remount fetches.
  const resetGuardedQueries = useCallback((): void => {
    for (const queryKey of queryKeys ?? []) void queryClient.resetQueries({ queryKey });
  }, [queryClient, queryKeys]);

  // Each boundary gets its own reset scope, so retrying one widget does not refetch the others.
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <LoadFailureBoundary
          onRetry={() => {
            resetGuardedQueries();
            reset();
          }}
          fallback={fallback}
        >
          {children}
        </LoadFailureBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

type DataLoaderImplProps<T, S extends Schema.Schema<any, any, never>> = (
  | DataLoaderProps<T>
  | DataLoaderPropsWithSchema<S>
) & {
  schema?: S;
};

/** DataLoader's props once DataLoader has resolved the query key and the loading UI. */
type ResolvedDataLoaderProps<T, S extends Schema.Schema<any, any, never>> = DataLoaderImplProps<
  T,
  S
> & {
  queryKey: QueryKey;
  LoadingComponent: React.ReactNode;
};

/** How DataLoader calls its children: a one-argument render prop ignores the utilities. */
type RenderChildren = (data: unknown, utils: DataLoaderRenderProps<unknown>) => React.ReactNode;

/** Logs a failed request with where it came from, then calls the caller's `onError`. */
function logLoadFailure(url: string, err: unknown, onError?: (error: Error) => void): void {
  logger.info(`[DataLoader]: ${parseCodePathDetailed(url, fetcher)}`);

  if (err instanceof FetcherError) {
    logger.error(`[DataLoader]: Status ${err.status}`, err.responseData);
  } else if (err instanceof ValidationError) {
    logger.error(`[DataLoader]: Validation failed - ${err.getProblemsString()}`);
    logger.error(`[DataLoader]: Invalid data:`, err.responseData);
  } else {
    logger.error('[DataLoader]: Unexpected error', err);
  }

  if (onError && err instanceof Error) onError(err);
}

/**
 * The fetcher options for one DataLoader. `retries: 0` makes one attempt per queryFn and leaves
 * retrying to TanStack Query (shouldRetryQuery), so failures are not retried at two layers. A
 * caller's `options.retries` would still override it; callers leave it unset or 0.
 */
function useFetcherOptions(
  url: string,
  options: FetcherOptions<any>,
  onError: ((error: Error) => void) | undefined,
  schema: Schema.Schema<any, any, never> | undefined,
): FetcherOptions<any> {
  return useMemo((): FetcherOptions<any> => {
    const baseOptions: FetcherOptions<any> = {
      retries: 0,
      timeout: DEFAULT_TIMEOUT_MS,
      onError: (err) => logLoadFailure(url, err, onError),
      ...options,
    };
    return schema ? { ...baseOptions, schema } : baseOptions;
  }, [url, options, onError, schema]);
}

/**
 * One GET of `url` through the page-wide request queue, which shares identical in-flight browser
 * requests. Rejects with the fetcher's own error: Effect.runPromise rejects with a FiberFailure,
 * and the error component and the retry rule (no retry for 4xx) need the FetcherError's status.
 */
async function requestThroughQueue(
  url: string,
  params: QueryParams,
  fetcherOptions: FetcherOptions<any>,
  resultKey: string | undefined,
): Promise<unknown> {
  try {
    return await requestQueue.enqueue(
      url,
      'GET',
      () =>
        Effect.runPromise(
          pipe(get(url, fetcherOptions, params), Effect.provide(FetchHttpClient.layer)),
        ),
      {
        // The query string is built from params, so calls that differ in it never share.
        body: params,
        headers: fetcherOptions.headers,
        // Each caller gets the result decoded with its own schema.
        resultKey,
        bypassDeduplication: false,
      },
    );
  } catch (error) {
    const failure = unwrapEffectError(error);
    if (failure instanceof ValidationError || failure instanceof FetcherError) throw failure;
    // Wrap unexpected request errors
    throw new FetcherError(
      failure instanceof Error ? failure.message : 'Unknown error occurred',
      url,
      undefined,
      failure,
    );
  }
}

interface QueryFnSettings {
  readonly url: string;
  readonly params: QueryParams;
  readonly fetcherOptions: FetcherOptions<any>;
  readonly transform?: (data: any) => unknown;
  readonly onSuccess?: (data: any) => void;
}

/** The query function: the request, then the caller's `transform` and `onSuccess`. */
function useDataLoaderQueryFn({
  url,
  params,
  fetcherOptions,
  transform,
  onSuccess,
}: QueryFnSettings): () => Promise<unknown> {
  // Keyed on the schema itself, so options passed inline don't format it again each render.
  const decodeSchema = fetcherOptions.schema;
  const resultKey = useMemo(() => schemaKeyOf(decodeSchema), [decodeSchema]);

  return useCallback(async () => {
    const result = await requestThroughQueue(url, params, fetcherOptions, resultKey);
    // The caller's callbacks run outside the request's try: an exception there is a bug in this
    // page, not a failed request, so it reaches LoadFailureBoundary unchanged and is reported once.
    const finalResult = typeof transform === 'function' ? transform(result) : result;
    if (onSuccess) onSuccess(finalResult);
    return finalResult;
  }, [url, params, fetcherOptions, resultKey, transform, onSuccess]);
}

/**
 * Runs DataLoader's query and renders its children with the data. Without data it suspends (the
 * gate's Suspense shows `LoadingComponent`); a failed first load throws to LoadFailureBoundary
 * (see DataLoader). Once data has loaded, a failed background refetch leaves that data in place
 * (TanStack keeps it beside the error), so the children keep showing it until a later refetch
 * succeeds.
 */
function DataLoaderQuery<T = unknown, S extends Schema.Schema<any, any, never> = any>({
  children,
  url,
  queryOptions,
  LoadingComponent,
  options,
  params = NO_PARAMS,
  queryKey,
  onSuccess,
  onError,
  transform,
  staleTime = DEFAULT_STALE_TIME_MS,
  refetchInterval = DEFAULT_REFETCH_INTERVAL_MS,
  refetchOnWindowFocus = false,
  refetchOnReconnect = true,
  schema,
}: ResolvedDataLoaderProps<T, S>): React.ReactElement {
  const queryClient = useQueryClient();
  const fetcherOptions = useFetcherOptions(url, options ?? NO_FETCHER_OPTIONS, onError, schema);
  const extraQueryOptions = (queryOptions ?? NO_QUERY_OPTIONS) as typeof NO_QUERY_OPTIONS;
  const queryFn = useDataLoaderQueryFn({ url, params, fetcherOptions, transform, onSuccess });

  // `retry` and `retryDelay` come from the QueryClient defaults (shouldRetryQuery in
  // query-client.ts) unless `queryOptions` overrides them.
  const suspenseQueryOptions = useMemo(
    (): UseSuspenseQueryOptions<unknown, Error, unknown, QueryKey> => ({
      queryKey,
      queryFn,
      staleTime,
      refetchInterval,
      refetchOnWindowFocus,
      refetchOnReconnect,
      ...extraQueryOptions,
    }),
    [
      queryKey,
      queryFn,
      staleTime,
      refetchInterval,
      refetchOnWindowFocus,
      refetchOnReconnect,
      extraQueryOptions,
    ],
  );

  // `data` is always defined here: without it, useSuspenseQuery suspends or throws instead.
  const { data, refetch, isRefetching } = useSuspenseQuery(suspenseQueryOptions);

  const renderProps = useMemo(
    (): DataLoaderRenderProps<unknown> => ({
      refetch: async () => {
        await refetch();
      },
      isRefetching,
      queryClient,
      invalidate: async () => {
        await queryClient.invalidateQueries({ queryKey });
      },
      setQueryData: (newData) => {
        queryClient.setQueryData(queryKey, newData);
      },
    }),
    [refetch, isRefetching, queryClient, queryKey],
  );

  const renderChildren = children as RenderChildren;
  return <Suspense fallback={LoadingComponent}>{renderChildren(data, renderProps)}</Suspense>;
}

/**
 * Decides where DataLoader's data comes from, so it never fetches during server rendering:
 * - On the server and while hydrating, with the data already in the QueryClient (a server
 *   component prefetched it behind a HydrationBoundary), it renders the query, which reads that
 *   data without fetching. The server HTML holds the content and hydrates with no flash.
 * - On the server and while hydrating, without the data, it renders `LoadingComponent` only. The
 *   server HTML holds the skeleton (card frame included), and hydration matches it.
 * - In the browser after hydration, and on a client-only mount, it renders the query, which
 *   fetches once (if it has no fresh data) behind a Suspense that shows `LoadingComponent`.
 *
 * Both hooks run on every render, whichever branch is taken.
 */
function DataLoaderGate<T = unknown, S extends Schema.Schema<any, any, never> = any>(
  props: ResolvedDataLoaderProps<T, S>,
): React.ReactElement {
  const { queryKey, LoadingComponent } = props;
  const queryClient = useQueryClient();
  const isServerHtml = useIsServerHtmlRender();
  const hasData = queryClient.getQueryData(queryKey) !== undefined;

  if (isServerHtml && !hasData) return <>{LoadingComponent}</>;
  return (
    <Suspense fallback={LoadingComponent}>
      <DataLoaderQuery {...props} />
    </Suspense>
  );
}

/**
 * Enhanced DataLoader component with Effect Schema validation, better error handling, caching, and developer experience.
 *
 * It never fetches during server rendering: the server HTML shows `LoadingComponent`, unless a
 * server component prefetched the same query key into the QueryClient (HydrationBoundary), in
 * which case it shows the data. The browser then fetches once, only if it has no fresh data.
 *
 * A failed first load renders `ErrorComponent` (default: ClientError) in place of the children,
 * with a `retry` that loads again; the failure does not reach the page's error boundary. A failed
 * background refetch keeps the loaded data on screen.
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
export function DataLoader<T = unknown, S extends Schema.Schema<any, any, never> = any>(
  props: DataLoaderImplProps<T, S>,
): React.ReactElement {
  const { ErrorComponent = ClientError, LoadingComponent = <Loader /> } = props;
  // Built once and handed down, so the gate, the query and the retry all use exactly this key.
  const queryKey = useDataLoaderKey(props);

  // Each DataLoader gets its own reset scope, so retrying one card does not refetch the others.
  return (
    <QueryErrorBoundary
      queryKeys={[queryKey]}
      fallback={(error, retry) => renderErrorComponent(ErrorComponent, error, retry)}
    >
      <DataLoaderGate {...props} queryKey={queryKey} LoadingComponent={LoadingComponent} />
    </QueryErrorBoundary>
  );
}

DataLoader.displayName = 'DataLoader';

export default DataLoader;
