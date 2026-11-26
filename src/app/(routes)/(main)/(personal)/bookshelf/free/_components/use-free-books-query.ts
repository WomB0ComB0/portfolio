/**
 * Copyright 2026 Mike Odnis
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

/**
 * @file The /bookshelf/free explorer's state: the URL (free-books-filters.ts, through nuqs), a
 * debounced search draft, and the TanStack Query fetch of each page from `GET /api/v1/books/free`.
 * The server-rendered first page is the query's initial data, so the default view makes no request.
 * A new page cancels the stale fetch, the next page is prefetched on hover or focus, and the
 * search is normalised (normaliseQuery) before it reaches the URL or the API. Guarded by
 * tests/unit/free-books/explorer.test.tsx.
 */

import {
  keepPreviousData,
  type UseQueryResult,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { type SetValues, useQueryStates, type Values } from 'nuqs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_QUERY_MAX_LENGTH, normaliseQuery } from '@/lib/filters/normalise';
import {
  FREE_BOOKS_DEFAULT_PAGE_SIZE,
  type FreeBookEntry,
  type FreeBooksPageResponse,
  type FreeBooksSortDir,
  type FreeBooksSortField,
} from '@/lib/free-books/types';
import { BOOKSHELF_URL_OPTIONS } from '../../_lib/bookshelf-filters';
import {
  buildFreeBooksApiUrl,
  type FreeBooksApiParams,
  type FreeBooksPageSize,
  freeBooksSearchParsers,
  normalizeFreeBooksPageSize,
} from '../_lib/free-books-filters';

const CLIENT_STALE_TIME_MS = 5 * 60 * 1000;
const SEARCH_DEBOUNCE_MS = 250;

/** What the explorer reads and calls; one field per value the hook derives. */
export interface FreeBooksQuery {
  readonly state: Values<typeof freeBooksSearchParsers>;
  readonly setState: SetValues<typeof freeBooksSearchParsers>;
  readonly draftQuery: string;
  readonly handleSearchChange: (rawValue: string) => void;
  readonly commitSearchNow: (rawValue: string) => void;
  readonly pageSize: FreeBooksPageSize;
  readonly hideArchived: boolean;
  readonly hideUnavailable: boolean;
  readonly requestedPage: number;
  readonly activeData: FreeBooksPageResponse;
  readonly displayedBooks: readonly FreeBookEntry[];
  readonly totalMatched: number;
  readonly totalPages: number;
  readonly currentPage: number;
  readonly isFetching: boolean;
  readonly isPlaceholderData: boolean;
  readonly isInitialNonDefaultLoading: boolean;
  readonly isError: boolean;
  readonly refetch: UseQueryResult<FreeBooksPageResponse>['refetch'];
  readonly prefetchNextPage: () => void;
  readonly toggleSort: (field: FreeBooksSortField) => void;
  readonly resetFilters: () => void;
  readonly hasActiveFilter: boolean;
}

async function fetchFreeBooksPage(
  params: FreeBooksApiParams,
  signal?: AbortSignal,
): Promise<FreeBooksPageResponse> {
  const res = await fetch(buildFreeBooksApiUrl(params), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch free programming books (${res.status})`);
  }
  return (await res.json()) as FreeBooksPageResponse;
}

/**
 * The explorer's URL, search and page state. Typing is debounced by 250 ms; the server-rendered
 * first page needs no fetch; stale fetches are aborted; the next page can be prefetched.
 */
export function useFreeBooksQuery(initialPage: FreeBooksPageResponse): FreeBooksQuery {
  const queryClient = useQueryClient();
  const [state, setState] = useQueryStates(freeBooksSearchParsers, BOOKSHELF_URL_OPTIONS);
  const committedQuery = normaliseQuery(state.q, DEFAULT_QUERY_MAX_LENGTH);
  const [draftQuery, setDraftQuery] = useState(committedQuery);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingSearch = useCallback((): void => {
    if (searchTimerRef.current !== null) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setDraftQuery(committedQuery);
  }, [committedQuery]);

  useEffect(() => cancelPendingSearch, [cancelPendingSearch]);

  const commitSearchNow = useCallback(
    (rawValue: string): void => {
      cancelPendingSearch();
      const sanitized = normaliseQuery(rawValue, DEFAULT_QUERY_MAX_LENGTH);
      setDraftQuery(sanitized);
      if (sanitized !== committedQuery) {
        void setState({ q: sanitized, page: 1 });
      }
    },
    [cancelPendingSearch, committedQuery, setState],
  );

  const handleSearchChange = useCallback(
    (rawValue: string): void => {
      const capped = rawValue.slice(0, DEFAULT_QUERY_MAX_LENGTH);
      setDraftQuery(capped);
      cancelPendingSearch();
      const sanitized = normaliseQuery(capped, DEFAULT_QUERY_MAX_LENGTH);
      if (sanitized === '') {
        if (committedQuery !== '') {
          void setState({ q: '', page: 1 });
        }
        return;
      }
      searchTimerRef.current = setTimeout(() => {
        searchTimerRef.current = null;
        void setState({ q: sanitized, page: 1 });
      }, SEARCH_DEBOUNCE_MS);
    },
    [cancelPendingSearch, committedQuery, setState],
  );

  const pageSize = normalizeFreeBooksPageSize(state.perPage);
  const hideArchived = !state.archived;
  const hideUnavailable = !state.unavailable;
  const requestedPage = Math.max(1, state.page);

  const apiParams: FreeBooksApiParams = useMemo(
    () => ({
      source: state.source,
      category: normaliseQuery(state.category, DEFAULT_QUERY_MAX_LENGTH) || 'all',
      format: state.format,
      q: committedQuery,
      sort: state.sort,
      dir: state.dir,
      page: requestedPage,
      pageSize,
      hideArchived,
      hideUnavailable,
      hideInProcess: state.hideWip,
      httpsOnly: state.https,
      verifiedHostsOnly: state.verified,
    }),
    [
      state.source,
      state.category,
      state.format,
      committedQuery,
      state.sort,
      state.dir,
      requestedPage,
      pageSize,
      hideArchived,
      hideUnavailable,
      state.hideWip,
      state.https,
      state.verified,
    ],
  );

  const isDefaultInitialQuery =
    apiParams.source === 'all' &&
    apiParams.category === 'all' &&
    apiParams.format === 'all' &&
    apiParams.q.trim() === '' &&
    apiParams.sort === 'title' &&
    apiParams.dir === 'asc' &&
    apiParams.page === 1 &&
    apiParams.pageSize === initialPage.limit &&
    apiParams.hideArchived &&
    apiParams.hideUnavailable &&
    !apiParams.hideInProcess &&
    !apiParams.httpsOnly &&
    !apiParams.verifiedHostsOnly;

  const parsedInitialUpdatedAt = Date.parse(initialPage.fetchedAt);
  const { data, isFetching, isPlaceholderData, isError, refetch } = useQuery<FreeBooksPageResponse>(
    {
      queryKey: ['books', 'free', apiParams] as const,
      queryFn: ({ signal }) => fetchFreeBooksPage(apiParams, signal),
      placeholderData: keepPreviousData,
      staleTime: CLIENT_STALE_TIME_MS,
      ...(isDefaultInitialQuery
        ? {
            initialData: initialPage,
            initialDataUpdatedAt: Number.isFinite(parsedInitialUpdatedAt)
              ? parsedInitialUpdatedAt
              : Date.now(),
          }
        : {}),
    },
  );

  const activeData = data ?? initialPage;
  const isInitialNonDefaultLoading = !data && isFetching;
  const displayedBooks = isInitialNonDefaultLoading ? [] : activeData.items;
  const totalMatched = isInitialNonDefaultLoading ? 0 : activeData.totalMatched;
  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);

  const prefetchNextPage = useCallback((): void => {
    if (currentPage >= totalPages) return;
    const nextParams: FreeBooksApiParams = { ...apiParams, page: currentPage + 1 };
    void queryClient.prefetchQuery({
      queryKey: ['books', 'free', nextParams] as const,
      queryFn: ({ signal }) => fetchFreeBooksPage(nextParams, signal),
      staleTime: CLIENT_STALE_TIME_MS,
    });
  }, [apiParams, currentPage, queryClient, totalPages]);

  const toggleSort = useCallback(
    (field: FreeBooksSortField): void => {
      const nextDir: FreeBooksSortDir =
        state.sort === field && state.dir === 'asc' ? 'desc' : 'asc';
      void setState({ sort: field, dir: nextDir, page: 1 });
    },
    [setState, state.dir, state.sort],
  );

  const resetFilters = useCallback((): void => {
    cancelPendingSearch();
    setDraftQuery('');
    void setState({
      q: '',
      source: 'all',
      category: 'all',
      format: 'all',
      sort: 'title',
      dir: 'asc',
      page: 1,
      perPage: FREE_BOOKS_DEFAULT_PAGE_SIZE,
      archived: false,
      unavailable: false,
      hideWip: false,
      https: false,
      verified: false,
    });
  }, [cancelPendingSearch, setState]);

  const hasActiveFilter =
    state.source !== 'all' ||
    state.category !== 'all' ||
    state.format !== 'all' ||
    draftQuery.trim().length > 0 ||
    committedQuery.length > 0 ||
    state.archived ||
    state.unavailable ||
    state.hideWip ||
    state.https ||
    state.verified;

  return {
    state,
    setState,
    draftQuery,
    handleSearchChange,
    commitSearchNow,
    pageSize,
    hideArchived,
    hideUnavailable,
    requestedPage,
    activeData,
    displayedBooks,
    totalMatched,
    totalPages,
    currentPage,
    isFetching,
    isPlaceholderData,
    isInitialNonDefaultLoading,
    isError,
    refetch,
    prefetchNextPage,
    toggleSort,
    resetFilters,
    hasActiveFilter,
  };
}
