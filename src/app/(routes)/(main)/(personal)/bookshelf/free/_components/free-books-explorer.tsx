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

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useQueryStates } from 'nuqs';
import { type ReactElement, useDeferredValue, useMemo } from 'react';
import {
  FiArrowDown,
  FiArrowLeft,
  FiArrowUp,
  FiArrowUpRight,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiX,
} from 'react-icons/fi';
import { PageShell } from '@/components/console/page-shell';
import { StatStrip, type StatStripItem } from '@/components/console/stat-strip';
import {
  BOOKSHELF_URL_OPTIONS,
  FREE_BOOKS_PAGE_SIZES,
  type FreeBooksSortDir,
  type FreeBooksSortField,
  freeBooksSearchParsers,
  normalizeFreeBooksPageSize,
} from '@/lib/books/bookshelf-search-params';
import {
  EBOOK_FOUNDATION_REPO_URL,
  type FreeBookFormat,
  type FreeBookSource,
  type FreeBooksPageResponse,
} from '@/lib/books/free-programming-books';
import { cn } from '@/lib/utils';

export interface FreeBooksExplorerProps {
  /** Initial SSR-rendered page 1 (50 rows) + catalog summary stats & categories. */
  readonly initialPage: FreeBooksPageResponse;
}

const FORMAT_FILTERS: readonly ('all' | FreeBookFormat)[] = ['all', 'PDF', 'HTML', 'EPUB'];
const TOP_CATEGORY_CHIPS = 14;
const CLIENT_STALE_TIME_MS = 5 * 60 * 1000;

interface FreeBooksApiParams {
  readonly source: 'all' | FreeBookSource;
  readonly category: string;
  readonly format: 'all' | FreeBookFormat;
  readonly q: string;
  readonly sort: FreeBooksSortField;
  readonly dir: FreeBooksSortDir;
  readonly page: number;
  readonly pageSize: number;
  readonly hideArchived: boolean;
  readonly hideUnavailable: boolean;
  readonly hideInProcess: boolean;
  readonly httpsOnly: boolean;
  readonly verifiedHostsOnly: boolean;
}

function buildFreeBooksApiUrl(params: FreeBooksApiParams): string {
  const qs = new URLSearchParams();
  if (params.source !== 'all') qs.set('source', params.source);
  if (params.category !== 'all') qs.set('category', params.category);
  if (params.format !== 'all') qs.set('format', params.format);
  if (params.q.trim()) qs.set('q', params.q.trim());
  qs.set('sort', params.sort);
  qs.set('dir', params.dir);
  qs.set('hideArchived', String(params.hideArchived));
  qs.set('hideUnavailable', String(params.hideUnavailable));
  if (params.hideInProcess) qs.set('hideInProcess', 'true');
  if (params.httpsOnly) qs.set('httpsOnly', 'true');
  if (params.verifiedHostsOnly) qs.set('verifiedHostsOnly', 'true');
  qs.set('limit', String(params.pageSize));
  qs.set('offset', String((Math.max(1, params.page) - 1) * params.pageSize));
  return `/api/v1/books/free?${qs.toString()}`;
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

function SortIcon({
  active,
  dir,
}: {
  readonly active: boolean;
  readonly dir: FreeBooksSortDir;
}): ReactElement {
  if (!active) {
    return (
      <span aria-hidden="true" className="text-[10px] text-faint/60">
        ↕
      </span>
    );
  }
  return dir === 'asc' ? (
    <FiArrowUp aria-hidden="true" className="size-3 text-brand-ink" />
  ) : (
    <FiArrowDown aria-hidden="true" className="size-3 text-brand-ink" />
  );
}

/**
 * Live Console searchable, sortable, incrementally fetched data table for EbookFoundation's
 * 2,500+ free programming books:
 * - Page 1 (50 rows) arrives pre-rendered from the Server Component (cutting initial HTML by ~95%).
 * - Every filter, sort, and page transition is synced to the URL via a single batched `nuqs`
 *   `useQueryStates` hook and fetched incrementally from `/api/v1/books/free` via TanStack Query
 *   (`keepPreviousData`, AbortSignal cancellation, and hover/focus next-page prefetch).
 */
export function FreeBooksExplorer({ initialPage }: FreeBooksExplorerProps): ReactElement {
  const queryClient = useQueryClient();
  const [state, setState] = useQueryStates(freeBooksSearchParsers, BOOKSHELF_URL_OPTIONS);
  const deferredQuery = useDeferredValue(state.q);

  const pageSize = normalizeFreeBooksPageSize(state.perPage);
  const hideArchived = !state.archived;
  const hideUnavailable = !state.unavailable;
  const requestedPage = Math.max(1, state.page);

  const apiParams: FreeBooksApiParams = useMemo(
    () => ({
      source: state.source,
      category: state.category,
      format: state.format,
      q: deferredQuery,
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
      deferredQuery,
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

  const visibleCategories = useMemo(
    () =>
      activeData.categories.filter((item) =>
        state.source === 'all' ? true : item.source === state.source,
      ),
    [activeData.categories, state.source],
  );

  const topCategories = useMemo(
    () => visibleCategories.slice(0, TOP_CATEGORY_CHIPS),
    [visibleCategories],
  );

  const statItems = useMemo<readonly StatStripItem[]>(
    () => [
      { label: 'free books', value: activeData.totalCatalogBooks },
      { label: 'languages', value: activeData.languageCategoriesCount },
      { label: 'subjects', value: activeData.subjectCategoriesCount },
      { label: 'PDFs', value: activeData.pdfCount },
    ],
    [activeData],
  );

  const prefetchNextPage = (): void => {
    if (currentPage >= totalPages) return;
    const nextParams: FreeBooksApiParams = { ...apiParams, page: currentPage + 1 };
    void queryClient.prefetchQuery({
      queryKey: ['books', 'free', nextParams] as const,
      queryFn: ({ signal }) => fetchFreeBooksPage(nextParams, signal),
      staleTime: CLIENT_STALE_TIME_MS,
    });
  };

  const toggleSort = (field: FreeBooksSortField): void => {
    const nextDir: FreeBooksSortDir = state.sort === field && state.dir === 'asc' ? 'desc' : 'asc';
    void setState({ sort: field, dir: nextDir, page: 1 });
  };

  const resetFilters = (): void => {
    void setState({
      q: '',
      source: 'all',
      category: 'all',
      format: 'all',
      sort: 'title',
      dir: 'asc',
      page: 1,
      perPage: 50,
      archived: false,
      unavailable: false,
      hideWip: false,
      https: false,
      verified: false,
    });
  };

  const hasActiveFilter =
    state.source !== 'all' ||
    state.category !== 'all' ||
    state.format !== 'all' ||
    state.q.trim().length > 0 ||
    state.archived ||
    state.unavailable ||
    state.hideWip ||
    state.https ||
    state.verified;

  const ariaSortFor = (field: FreeBooksSortField): 'ascending' | 'descending' | 'none' => {
    if (state.sort !== field) return 'none';
    return state.dir === 'asc' ? 'ascending' : 'descending';
  };

  const rangeStart = totalMatched === 0 ? 0 : activeData.offset + 1;
  const rangeEnd = Math.min(activeData.offset + displayedBooks.length, totalMatched);

  return (
    <PageShell
      sizing="container"
      eyebrow="Open Library Index"
      title="Free Programming Books"
      description="Searchable, URL-synced index of open-access programming books fetched incrementally from EbookFoundation/free-programming-books and screened by our live security manifest."
      stats={
        <StatStrip
          aria-label="Free programming books summary"
          items={statItems}
          sizing="container"
        />
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/bookshelf"
            prefetch={false}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground no-underline transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
          >
            <FiArrowLeft className="size-4" aria-hidden="true" />
            3D Bookshelf
          </Link>
          <a
            href={EBOOK_FOUNDATION_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground no-underline transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
          >
            EbookFoundation
            <FiArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      }
      className="pb-16"
    >
      <div className="space-y-5">
        {/* Search + Source + Format Controls (all synced to URL via nuqs) */}
        <div className="space-y-4 rounded-tile border border-hairline bg-surface-1 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <FiSearch
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint"
              />
              <input
                type="search"
                value={state.q}
                onChange={(event) => {
                  void setState({ q: event.target.value, page: 1 });
                }}
                placeholder="Search title, author, language, or subject (e.g. Rust, Algorithms, OSTEP)..."
                aria-label="Search free programming books"
                className="h-10 w-full rounded-lg border border-hairline bg-canvas pl-10 pr-9 text-body-sm text-foreground placeholder:text-faint focus-visible:border-brand-rim focus-visible:outline-2 focus-visible:outline-focus"
              />
              {state.q && (
                <button
                  type="button"
                  onClick={() => {
                    void setState({ q: '', page: 1 });
                  }}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-faint hover:bg-surface-2 hover:text-foreground"
                >
                  <FiX className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <fieldset
              aria-label="Book index source"
              className="m-0 inline-flex flex-wrap items-center gap-1 rounded-full border border-hairline bg-canvas p-1"
            >
              {(
                [
                  { id: 'all', label: 'All', count: activeData.totalCatalogBooks },
                  { id: 'langs', label: 'Languages', count: activeData.langsCount },
                  { id: 'subjects', label: 'Subjects', count: activeData.subjectsCount },
                ] as const
              ).map((tab) => {
                const active = state.source === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      void setState({ source: tab.id, category: 'all', page: 1 });
                    }}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-label font-medium transition-colors',
                      active
                        ? 'border border-brand-edge bg-brand-subtle text-foreground'
                        : 'border border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className="tabular-nums text-faint">{tab.count}</span>
                  </button>
                );
              })}
            </fieldset>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <fieldset
                aria-label="Filter by format"
                className="m-0 inline-flex flex-wrap items-center gap-1 rounded-full border border-hairline bg-canvas p-1"
              >
                {FORMAT_FILTERS.map((fmt) => {
                  const active = state.format === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        void setState({ format: fmt, page: 1 });
                      }}
                      className={cn(
                        'inline-flex h-7 items-center rounded-full px-2.5 font-mono text-[11px] font-medium transition-colors',
                        active
                          ? 'border border-brand-edge bg-brand-subtle text-foreground'
                          : 'border border-transparent text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {fmt === 'all' ? 'All formats' : fmt}
                    </button>
                  );
                })}
              </fieldset>

              <label className="inline-flex items-center gap-2">
                <span className="sr-only">Category</span>
                <select
                  aria-label="Filter by language or subject"
                  value={state.category}
                  onChange={(event) => {
                    void setState({ category: event.target.value, page: 1 });
                  }}
                  className="h-9 max-w-[240px] rounded-lg border border-hairline bg-canvas px-3 text-label text-foreground focus-visible:border-brand-rim focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <option value="all">
                    All{' '}
                    {state.source === 'langs'
                      ? 'languages'
                      : state.source === 'subjects'
                        ? 'subjects'
                        : 'categories'}{' '}
                    ({visibleCategories.length})
                  </option>
                  {visibleCategories.map((item) => (
                    <option key={`${item.source}-${item.name}`} value={item.name}>
                      {item.name} ({item.count})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-label text-muted-foreground">
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.verified}
                  onChange={(event) => {
                    void setState({ verified: event.target.checked, page: 1 });
                  }}
                  className="size-3.5 accent-[var(--brand)]"
                />
                <span>Verified hosts only</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.https}
                  onChange={(event) => {
                    void setState({ https: event.target.checked, page: 1 });
                  }}
                  className="size-3.5 accent-[var(--brand)]"
                />
                <span>HTTPS only</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={hideUnavailable}
                  onChange={(event) => {
                    void setState({ unavailable: !event.target.checked, page: 1 });
                  }}
                  className="size-3.5 accent-[var(--brand)]"
                />
                <span>Hide unavailable</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={hideArchived}
                  onChange={(event) => {
                    void setState({ archived: !event.target.checked, page: 1 });
                  }}
                  className="size-3.5 accent-[var(--brand)]"
                />
                <span>Hide archived</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.hideWip}
                  onChange={(event) => {
                    void setState({ hideWip: event.target.checked, page: 1 });
                  }}
                  className="size-3.5 accent-[var(--brand)]"
                />
                <span>Hide in-progress</span>
              </label>
            </div>
          </div>

          {topCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline pt-3">
              <button
                type="button"
                onClick={() => {
                  void setState({ category: 'all', page: 1 });
                }}
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] transition-colors',
                  state.category === 'all'
                    ? 'border-brand-edge bg-brand-subtle text-foreground'
                    : 'border-hairline bg-canvas text-muted-foreground hover:border-hairline-strong hover:text-foreground',
                )}
              >
                All
              </button>
              {topCategories.map((item) => {
                const active = state.category.toLowerCase() === item.name.toLowerCase();
                return (
                  <button
                    key={`${item.source}-${item.name}`}
                    type="button"
                    onClick={() => {
                      void setState({ category: active ? 'all' : item.name, page: 1 });
                    }}
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors',
                      active
                        ? 'border-brand-edge bg-brand-subtle text-foreground'
                        : 'border-hairline bg-canvas text-muted-foreground hover:border-hairline-strong hover:text-foreground',
                    )}
                  >
                    <span>{item.name}</span>
                    <span className="font-mono text-[11px] tabular-nums text-faint">
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Transient API error banner */}
        {isError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline-strong bg-[var(--down-tint)] px-4 py-2.5 tile-meta text-down"
          >
            <span>Could not refresh this page from /api/v1/books/free.</span>
            <button
              type="button"
              onClick={() => {
                void refetch();
              }}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Try again
            </button>
          </div>
        )}

        {/* Results & Pagination Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tile-meta tabular-nums text-muted-foreground">
            Showing{' '}
            <span className="text-foreground">
              {rangeStart}–{rangeEnd}
            </span>{' '}
            of <span className="text-foreground">{totalMatched}</span> matching books
            {state.category !== 'all' ? ` in ${state.category}` : ''}
            {isFetching && <span className="ml-2 font-mono text-[11px] text-faint">Updating…</span>}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="tile-meta text-brand-ink underline-offset-4 hover:text-foreground hover:underline"
              >
                Reset filters
              </button>
            )}
            <label className="inline-flex items-center gap-1.5 tile-meta text-faint">
              <span>Rows</span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(event) => {
                  const next = normalizeFreeBooksPageSize(Number.parseInt(event.target.value, 10));
                  void setState({ perPage: next, page: 1 });
                }}
                className="h-7 rounded-md border border-hairline bg-surface-1 px-2 font-mono text-[11px] text-foreground focus-visible:border-brand-rim focus-visible:outline-2 focus-visible:outline-focus"
              >
                {FREE_BOOKS_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* High-density Live Console Data Table */}
        {isInitialNonDefaultLoading ? (
          <output
            aria-live="polite"
            className="block rounded-tile border border-hairline bg-surface-1 p-10 text-center"
          >
            <p className="tile-sub text-foreground">Loading matching books…</p>
            <p className="mt-1 tile-meta text-muted-foreground">
              Fetching page {requestedPage} from{' '}
              <code className="font-mono text-foreground">/api/v1/books/free</code>.
            </p>
          </output>
        ) : displayedBooks.length === 0 ? (
          <div className="rounded-tile border border-hairline bg-surface-1 p-10 text-center">
            <p className="tile-sub text-foreground">No free books match that filter.</p>
            <p className="mt-1 tile-meta text-muted-foreground">
              Try clearing your search query or switching between Languages and Subjects.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex h-9 items-center rounded-md border border-hairline bg-surface-2 px-3.5 tile-label text-foreground hover:border-hairline-strong"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div
            className={cn(
              'overflow-hidden rounded-tile border border-hairline bg-canvas transition-opacity duration-150',
              isPlaceholderData && 'opacity-70',
            )}
          >
            <table
              aria-label="Free programming books catalog"
              aria-busy={isFetching}
              className="w-full table-fixed border-separate border-spacing-0"
            >
              <colgroup>
                <col />
                <col className="hidden w-[21%] @min-[40rem]/page:table-column" />
                <col className="hidden w-[17%] @min-[40rem]/page:table-column" />
                <col className="hidden w-[22%] @min-[48rem]/page:table-column" />
              </colgroup>
              <thead className="hidden @min-[40rem]/page:table-header-group">
                <tr className="bg-surface-1">
                  <th
                    scope="col"
                    aria-sort={ariaSortFor('title')}
                    className="border-b border-hairline-strong px-3 py-2.5 text-left tile-label text-faint"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort('title')}
                      className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <span>Book</span>
                      <SortIcon active={state.sort === 'title'} dir={state.dir} />
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={ariaSortFor('category')}
                    className="border-b border-hairline-strong px-3 py-2.5 text-left tile-label text-faint"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort('category')}
                      className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <span>Category</span>
                      <SortIcon active={state.sort === 'category'} dir={state.dir} />
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="border-b border-hairline-strong px-3 py-2.5 text-left tile-label text-faint"
                  >
                    Format &amp; Flags
                  </th>
                  <th
                    scope="col"
                    aria-sort={ariaSortFor('host')}
                    className="hidden border-b border-hairline-strong px-3 py-2.5 text-left tile-label text-faint @min-[48rem]/page:table-cell"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort('host')}
                      className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <span>Host</span>
                      <SortIcon active={state.sort === 'host'} dir={state.dir} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedBooks.map((book) => (
                  <tr
                    key={book.id}
                    className="group/row relative [transform:translate(0)] transition-colors duration-100 hover:bg-surface-1 focus-within:bg-surface-1"
                  >
                    <td className="border-b border-hairline px-3 py-3 align-middle">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <a
                          href={book.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          referrerPolicy="no-referrer"
                          className="inline-flex max-w-full items-baseline gap-1.5 text-body-sm font-medium text-foreground no-underline after:absolute after:inset-0 after:content-[''] group-hover/row:text-brand-ink focus-visible:outline-2 focus-visible:outline-focus"
                        >
                          <span className="truncate">{book.title}</span>
                          <FiArrowUpRight
                            aria-hidden="true"
                            className="size-3.5 shrink-0 text-faint transition-transform duration-150 group-hover/row:translate-x-0.5 group-hover/row:-translate-y-0.5 group-hover/row:text-brand-ink"
                          />
                        </a>
                        {book.authors && (
                          <span className="truncate tile-meta text-muted-foreground">
                            {book.authors}
                          </span>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-faint @min-[40rem]/page:hidden">
                          <span>{book.category}</span>
                          {book.formats.length > 0 && <span>· {book.formats.join(', ')}</span>}
                          <span>· {book.host}</span>
                        </div>
                      </div>
                    </td>

                    <td className="hidden border-b border-hairline px-3 py-3 align-middle @min-[40rem]/page:table-cell">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-label text-foreground">{book.category}</span>
                        {book.subcategory && (
                          <span className="truncate font-mono text-[11px] text-faint">
                            {book.subcategory}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="hidden border-b border-hairline px-3 py-3 align-middle @min-[40rem]/page:table-cell">
                      <div className="flex flex-wrap items-center gap-1">
                        {book.formats.length > 0 ? (
                          book.formats.map((fmt) => (
                            <span
                              key={fmt}
                              className="rounded-full border border-brand-edge bg-brand-subtle px-2 py-0.5 font-mono text-[10px] font-medium text-brand-ink"
                            >
                              {fmt}
                            </span>
                          ))
                        ) : (
                          <span className="font-mono text-[11px] text-faint">Web</span>
                        )}
                        {book.license && (
                          <span className="rounded-full border border-hairline bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint">
                            {book.license}
                          </span>
                        )}
                        {book.insecureTransport && (
                          <span className="rounded-full border border-hairline-strong bg-[var(--ongoing-tint)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ongoing)]">
                            HTTP
                          </span>
                        )}
                        {book.unavailable && (
                          <span className="rounded-full border border-hairline-strong bg-[var(--down-tint)] px-1.5 py-0.5 font-mono text-[10px] text-down">
                            Unavailable
                          </span>
                        )}
                        {book.inProcess && (
                          <span className="rounded-full border border-hairline-strong bg-[var(--ongoing-tint)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ongoing)]">
                            WIP
                          </span>
                        )}
                        {book.archived && (
                          <span className="rounded-full border border-hairline bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint">
                            Archived
                          </span>
                        )}
                        {book.requiresAccount && (
                          <span className="rounded-full border border-hairline bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint">
                            Account
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="hidden border-b border-hairline px-3 py-3 align-middle @min-[48rem]/page:table-cell">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span
                          title={
                            book.trustTier === 'verified'
                              ? `Verified publisher/repository host (${book.host})`
                              : `Independent external host (${book.host})`
                          }
                          className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-muted-foreground"
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              'size-1.5 shrink-0 rounded-full',
                              book.trustTier === 'verified'
                                ? 'bg-[var(--live)]'
                                : 'bg-hairline-strong',
                            )}
                          />
                          <span className="truncate">{book.host}</span>
                        </span>
                        {book.trustTier === 'external' && (
                          <a
                            href={`https://web.archive.org/web/*/${book.url}`}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            referrerPolicy="no-referrer"
                            title="Open archived Wayback Machine snapshot"
                            className="relative z-[1] shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] text-faint no-underline transition-colors hover:bg-surface-2 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-focus"
                          >
                            Wayback ↗
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginated Navigation Bar (prefetches next page on hover/focus) */}
        {totalPages > 1 && (
          <nav
            aria-label="Free books pagination"
            className="flex flex-wrap items-center justify-between gap-3 pt-1"
          >
            <span className="tile-meta tabular-nums text-faint">
              Page <span className="text-foreground">{currentPage}</span> of{' '}
              <span className="text-foreground">{totalPages}</span>
            </span>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => {
                  void setState({ page: Math.max(1, currentPage - 1) });
                }}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-foreground transition-colors hover:border-brand-rim hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-focus"
              >
                <FiChevronLeft className="size-3.5" aria-hidden="true" />
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onMouseEnter={prefetchNextPage}
                onFocus={prefetchNextPage}
                onClick={() => {
                  void setState({ page: Math.min(totalPages, currentPage + 1) });
                }}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-foreground transition-colors hover:border-brand-rim hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-focus"
              >
                Next
                <FiChevronRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </nav>
        )}

        {/* Attribution & live security manifest telemetry footer */}
        <p className="border-t border-hairline pt-4 tile-meta text-faint">
          Index sourced from{' '}
          <a
            href={activeData.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline"
          >
            EbookFoundation/free-programming-books
          </a>{' '}
          ({activeData.license}) · Screened via{' '}
          {activeData.manifestSource === 'redis'
            ? 'live Redis security overlay'
            : 'bundled security manifest'}
          {activeData.quarantinedCount > 0 ? ` (${activeData.quarantinedCount} quarantined)` : ''} ·
          Incremental JSON API at{' '}
          <code className="font-mono text-muted-foreground">/api/v1/books/free</code>.
        </p>
      </div>
    </PageShell>
  );
}
